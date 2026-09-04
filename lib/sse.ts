/**
 * Server-sent-event frame scanning, for a runtime that cannot stream `fetch`.
 *
 * React Native has no `ReadableStream` on `Response.body`, so the only way to
 * read a response before it finishes is `XMLHttpRequest`: at `readyState === 3`
 * the whole response *so far* is available as `xhr.responseText`, and the
 * caller re-reads it on every tick. This module turns that growing string into
 * discrete SSE frames.
 *
 * WHY IT SCANS AN OFFSET INSTEAD OF CONSUMING DELTAS
 *
 * The obvious design — slice off `responseText.slice(lastLength)` and feed the
 * delta to a stateful parser — is wrong here, and the failure is invisible in
 * English. `responseText` is a decode of the bytes received so far, and a
 * multi-byte character split across two TCP reads decodes as U+FFFD until its
 * remaining bytes arrive. Spanish is full of them: `¡`, `é`, `ñ`. A delta-based
 * parser keeps the replacement character forever, because it never looks at
 * that region of the string again. Re-scanning from a byte-safe boundary does
 * not: the next tick re-reads those characters from a `responseText` that has
 * since decoded them correctly.
 *
 * The boundary we resume from is the end of the last COMPLETE frame — always a
 * blank line, always plain ASCII, so it can never fall inside a character.
 */

/** One decoded SSE frame. `event` defaults to `message` per the spec. */
export interface SseEvent {
  event: string;
  data: string;
}

export interface SseScanResult {
  /** Frames that were complete in `text`. */
  events: SseEvent[];
  /**
   * Absolute index in `text` just past the last complete frame. Pass this back
   * as `from` on the next scan. Anything after it is a partial frame and will
   * be re-read — see the note above about why re-reading is the point.
   */
  consumed: number;
}

/**
 * Pull every complete frame out of `text`, starting at `from`.
 *
 * Pure: no buffers, no instance state. Two calls with the same arguments give
 * the same answer, which is what makes the streaming path testable without an
 * XHR, a server, or a device.
 */
export function scanSseFrames(text: string, from = 0): SseScanResult {
  const events: SseEvent[] = [];
  let cursor = from;
  let consumed = from;

  while (cursor < text.length) {
    const end = findFrameEnd(text, cursor);
    if (end < 0) break;

    const frame = text.slice(cursor, end);
    const parsed = parseFrame(frame);
    if (parsed) events.push(parsed);

    cursor = skipFrameSeparator(text, end);
    consumed = cursor;
  }

  return { events, consumed };
}

/**
 * Index of the first character of the blank line that terminates the frame
 * starting at `start`, or -1 if no complete frame is there yet.
 *
 * Both `\n\n` and `\r\n\r\n` end a frame. Supabase's edge runtime emits `\n\n`,
 * but a proxy in front of it is entitled to rewrite line endings and this is
 * cheap insurance against a bug that would only ever appear in production.
 */
function findFrameEnd(text: string, start: number): number {
  const lf = text.indexOf('\n\n', start);
  const crlf = text.indexOf('\r\n\r\n', start);
  if (lf < 0) return crlf;
  if (crlf < 0) return lf;
  return Math.min(lf, crlf);
}

function skipFrameSeparator(text: string, end: number): number {
  return text.startsWith('\r\n\r\n', end) ? end + 4 : end + 2;
}

/**
 * Decode one frame's field lines.
 *
 * Returns null for a frame carrying no `data:` line at all — a comment-only
 * keep-alive (`: ping`), which servers send to hold an idle connection open and
 * which must not surface as an event.
 */
function parseFrame(frame: string): SseEvent | null {
  let event = 'message';
  const data: string[] = [];
  let sawData = false;

  for (const rawLine of frame.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line.length === 0) continue;
    // A leading colon is a comment. Keep-alives arrive as `:` or `: ping`.
    if (line.startsWith(':')) continue;

    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    // Exactly one optional space after the colon is part of the framing, not
    // the value. Stripping more would eat indentation out of the payload.
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') event = value;
    else if (field === 'data') {
      data.push(value);
      sawData = true;
    }
    // `id` and `retry` are spec fields we have no use for; anything else is
    // an extension. Both are ignored rather than treated as an error.
  }

  if (!sawData) return null;
  return { event, data: data.join('\n') };
}

/**
 * `JSON.parse` that answers "no" instead of throwing.
 *
 * A truncated or non-JSON `data:` payload is a broken frame, not a crash: the
 * stream reader skips it and keeps going, because losing one frame is survivable
 * and losing the turn is not.
 */
export function parseSseData<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}
