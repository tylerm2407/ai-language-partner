/**
 * Server-sent events, both directions.
 *
 * Outbound (`sseFrame`): the frames this function writes to the client.
 * Inbound (`SseDecoder`, `anthropicDeltaText`): the frames Anthropic writes to
 * us when the request body carries `"stream": true`.
 *
 * It is one small file because the two halves share the one rule that actually
 * bites: an SSE event is terminated by a BLANK LINE, and a chunk boundary can
 * land anywhere — mid-field, mid-JSON, between the `\r` and the `\n`. A
 * decoder that assumes each network read is a whole event works perfectly in
 * every local test and drops text under real network conditions.
 *
 * Pure: no Deno APIs, no network, no I/O. See ./sse.test.ts.
 */

/**
 * Encode one outbound frame.
 *
 * `data` is JSON on a single line by construction — `JSON.stringify` escapes
 * newlines — so we never have to emit a multi-line `data:` field, and a client
 * that splits on the blank line cannot mis-frame us.
 */
export function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export interface SseEvent {
  /** The `event:` field, or '' when the producer sent none. */
  event: string;
  /** The `data:` field(s), joined by newline as the SSE spec requires. */
  data: string;
}

/**
 * Incremental SSE parser.
 *
 * Deliberately tolerant: unknown fields (`id:`, `retry:`), comment lines
 * (`: ping`, which Anthropic sends to hold the connection open), and `\r\n`
 * line endings all pass through without producing an event.
 */
export class SseDecoder {
  #buffer = '';
  #event = '';
  #data: string[] = [];

  /** Feed the next decoded chunk. Returns every event it completed. */
  push(chunk: string): SseEvent[] {
    this.#buffer += chunk;
    const out: SseEvent[] = [];
    for (;;) {
      const nl = this.#buffer.indexOf('\n');
      // A line without its terminator is not a line yet — it could still grow.
      if (nl === -1) break;
      const line = this.#buffer.slice(0, nl).replace(/\r$/, '');
      this.#buffer = this.#buffer.slice(nl + 1);

      if (line === '') {
        // Blank line: dispatch, unless there was nothing to dispatch.
        if (this.#data.length > 0 || this.#event) {
          out.push({ event: this.#event, data: this.#data.join('\n') });
        }
        this.#event = '';
        this.#data = [];
        continue;
      }
      if (line.startsWith(':')) continue; // comment / keep-alive

      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      // One optional space after the colon is part of the framing, not the
      // value — `data: {` and `data:{` mean the same thing.
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);

      if (field === 'event') this.#event = value;
      else if (field === 'data') this.#data.push(value);
    }
    return out;
  }
}

/**
 * The text carried by one Anthropic stream event, or null if it carries none.
 *
 * Only `content_block_delta` events with a `text_delta` carry reply text.
 * Everything else in the stream — `message_start`, `content_block_start`,
 * `message_delta` (which carries stop_reason and usage), `message_stop`,
 * `ping` — is bookkeeping we do not need, because the JSON extractor
 * downstream already knows when the value it wants has ended.
 */
export function anthropicDeltaText(event: SseEvent): string | null {
  if (event.event && event.event !== 'content_block_delta') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(event.data);
  } catch {
    // A frame we cannot parse is not a reason to abandon the turn; the next
    // one usually parses, and a dropped delta is caught by the final
    // whole-text parse in index.ts.
    return null;
  }
  const obj = parsed as { type?: string; delta?: { type?: string; text?: string } };
  if (obj?.type !== 'content_block_delta') return null;
  if (obj.delta?.type !== 'text_delta') return null;
  return typeof obj.delta.text === 'string' ? obj.delta.text : null;
}

/**
 * The provider's own error, when it sends one mid-stream.
 *
 * Anthropic can accept a streaming request with a 200 and then emit
 * `event: error` — an overload, a timeout on their side. Without this the
 * stream would simply end early and the learner would get a truncated reply
 * with no indication anything went wrong.
 */
export function anthropicStreamError(event: SseEvent): string | null {
  if (event.event !== 'error') return null;
  try {
    const obj = JSON.parse(event.data) as { error?: { type?: string; message?: string } };
    return obj?.error?.type ?? 'stream_error';
  } catch {
    return 'stream_error';
  }
}
