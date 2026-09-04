/**
 * Read a streaming Anthropic completion and hand out the reply a sentence at a
 * time, each one safety-checked before it leaves.
 *
 * ── Why this does not use `generateValidated` ─────────────────────────────
 *
 * `generateValidated` (_shared/validated-generate.ts) is the safety pipeline
 * CLAUDE.md §1.1 mandates, and the non-streaming path still uses it unchanged.
 * It cannot wrap a stream, for a structural reason rather than a stylistic
 * one: its contract is "validate the COMPLETE text, and if it fails, throw the
 * attempt away and generate another". Once a sentence has been sent to the
 * client that bargain no longer exists — there is nothing to throw away.
 *
 * So the streaming path keeps the guarantee and drops the retry. The guarantee
 * is the part that matters: NOTHING reaches the learner that has not passed
 * `validateContentSafety` first. A sentence is emitted only after it is
 * complete AND clean; the moment one fails, we stop reading the model, discard
 * everything after it, and the caller sends the pre-authored fallback.
 *
 * On one axis this is strictly BETTER than what it replaces. Today the
 * validator sees the whole JSON envelope — reply, correction explanation,
 * vocabulary, gloss — as one string. A single flagged word anywhere in it
 * (`kill` in "kill time", say, which VIOLENCE_PATTERNS matches) discards the
 * learner's reply AND the correction that would have taught them something.
 * Per-sentence validation over the reply text alone cannot do that: the
 * correction is validated separately by the caller, so one false positive can
 * no longer take the other half of the turn down with it.
 *
 * What it gives up is the two safety retries. That is a deliberate trade: a
 * retry is only free before the first byte is out, and the whole point of
 * streaming is that the first byte leaves early.
 */

import { anthropicDeltaText, anthropicStreamError, SseDecoder, sseFrame } from './sse.ts';
import { JsonStringValueStream } from '../_shared/json-string-stream.ts';
import { splitCompleteSentences } from './sentence-buffer.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { validateContentSafety } from '../_shared/content-safety.ts';
import { validateContentLevel, type CEFR } from '../_shared/level-checker.ts';
import { PROVIDER_TIMEOUT_MS, providerFetch } from '../_shared/provider-fetch.ts';

export type StreamOutcome =
  /** The model finished. `rawText` is the complete envelope, for parsing. */
  | { kind: 'complete'; rawText: string }
  /** A sentence failed safety. Nothing after it was read or emitted. */
  | { kind: 'unsafe'; reasons: string[] }
  /** The provider gave up mid-stream. */
  | { kind: 'provider_error'; message: string };

export interface ReadReplyStreamOpts {
  /** The provider's SSE response body. */
  body: ReadableStream<Uint8Array>;
  /** Emit one validated sentence. Awaited, so order is preserved. */
  onSentence: (text: string) => void | Promise<void>;
  /**
   * The safety gate. Injected rather than imported so the tests can drive the
   * unsafe path without depending on which words the pattern lists happen to
   * contain this week — in production this is `validateContentSafety`.
   */
  validate: (text: string) => Promise<{ safe: boolean; reasons: string[] }>;
}

/**
 * Consume the provider stream to completion (or to the first problem).
 *
 * Reading continues past the end of the `reply` value on purpose: the
 * correction, the vocabulary list and the gloss come after it in the same
 * envelope, and `parseAIResponse` needs the whole thing. Only the reply is
 * streamed; the rest arrives with the `done` frame, as it always has.
 */
export async function readReplyStream(opts: ReadReplyStreamOpts): Promise<StreamOutcome> {
  const { body, onSentence, validate } = opts;
  const reader = body.getReader();
  // `stream: true` on the decoder: a multi-byte character split across two
  // network reads is the normal case for every language this app teaches.
  const bytes = new TextDecoder('utf-8');
  const sse = new SseDecoder();
  const replyValue = new JsonStringValueStream('reply');

  let rawText = '';
  let buffer = '';
  let replyClosed = false;

  /** Emit every sentence the buffer can prove complete. Returns the reasons a
   *  sentence was refused, or null if all of them passed. */
  const drain = async (final: boolean): Promise<string[] | null> => {
    const pieces: string[] = [];
    if (final) {
      // End of the value (or of the stream): whatever is left is the last
      // sentence, terminator or not. A model that stops mid-sentence still
      // said something, and the learner should hear it.
      const tail = buffer + replyValue.end();
      buffer = '';
      if (tail.trim()) pieces.push(tail);
    } else {
      const out = splitCompleteSentences(buffer);
      buffer = out.rest;
      pieces.push(...out.sentences);
    }
    for (const piece of pieces) {
      const check = await validate(piece);
      if (!check.safe) return check.reasons;
      await onSentence(piece);
    }
    return null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of sse.push(bytes.decode(value, { stream: true }))) {
        const providerError = anthropicStreamError(event);
        if (providerError) {
          await reader.cancel().catch(() => {});
          return { kind: 'provider_error', message: providerError };
        }
        const delta = anthropicDeltaText(event);
        if (delta === null) continue;
        rawText += delta;
        if (replyClosed) continue; // still collecting, no longer emitting

        buffer += replyValue.push(delta);
        const refused = await drain(false);
        if (refused) {
          await reader.cancel().catch(() => {});
          return { kind: 'unsafe', reasons: refused };
        }
        if (replyValue.done) {
          replyClosed = true;
          const refusedTail = await drain(true);
          if (refusedTail) {
            await reader.cancel().catch(() => {});
            return { kind: 'unsafe', reasons: refusedTail };
          }
        }
      }
    }

    // The stream ended without the reply's closing quote — a truncated
    // completion (max_tokens) or a dropped connection. Flush what we have
    // rather than swallow it.
    if (!replyClosed) {
      const refused = await drain(true);
      if (refused) return { kind: 'unsafe', reasons: refused };
    }
    return { kind: 'complete', rawText };
  } finally {
    reader.releaseLock();
  }
}

// ─── The SSE response ────────────────────────────────────────────────────

/** The one message the client is ever shown when a turn fails. The provider's
 *  own error text quotes the request — and therefore the system prompt — back
 *  at us, so it is logged and never returned (CLAUDE.md §6). */
const CLIENT_ERROR = {
  error: 'Chat is temporarily unavailable. Please try again.',
  code: 'CHAT_FAILED',
} as const;

export interface ChatStreamOpts {
  /** The Anthropic request body the non-streaming path uses, verbatim. Only
   *  `stream: true` is added — see the comment on its construction. */
  requestBody: Record<string, unknown>;
  apiKey: string;
  /** Pre-authored reply for when a sentence fails safety. */
  fallbackReply: string;
  /** For the structured logs, so a streamed turn is greppable next to a
   *  non-streamed one (same `evt` names as validated-generate.ts). */
  language: string;
  targetLevel: CEFR;
  /** Run the turn's side effects and build the `done` payload. */
  finalize: (rawText: string) => Promise<unknown>;
  /** Run the side effects that survive a discarded reply. */
  finalizeFallback: () => Promise<void>;
}

/**
 * The streaming half of ai-chat, as a `Response` the handler can return.
 *
 * Frames, in the only orders that can occur:
 *   chunk* done        — the normal turn
 *   chunk* fallback    — a sentence failed safety; the client replaces what it
 *                        has shown with the fallback text
 *   chunk* error       — the provider gave up; the client keeps what it has
 *                        and surfaces a retry
 *
 * Quota and the burst limit are consumed by the caller BEFORE this runs, and a
 * 429 is a normal JSON response with a 429 status — never an SSE frame. The
 * client checks the status code before it opens the stream, so a limit reached
 * has to be visible there.
 */
export function chatStreamResponse(opts: ChatStreamOpts): Response {
  const encoder = new TextEncoder();
  const { language, targetLevel } = opts;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseFrame(event, data)));
      };
      const log = (fields: Record<string, unknown>) => {
        console.log(JSON.stringify({ fn: 'ai-chat', language, ts: new Date().toISOString(), ...fields }));
      };

      try {
        const response = await providerFetch(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': opts.apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({ ...opts.requestBody, stream: true }),
          },
          { provider: 'anthropic', timeoutMs: PROVIDER_TIMEOUT_MS.text },
        );

        if (!response.ok || !response.body) {
          const detail = response.ok ? 'no response body' : await response.text().catch(() => '');
          log({
            evt: 'provider_error',
            attempt: 1,
            message: `stream open failed: ${response.status} ${detail}`.slice(0, 300),
          });
          send('error', CLIENT_ERROR);
          return;
        }

        const outcome = await readReplyStream({
          body: response.body,
          onSentence: (text) => send('chunk', { text }),
          validate: async (text) => {
            const check = await validateContentSafety(text, { language, fn: 'ai-chat' });
            return { safe: check.safe, reasons: check.reasons };
          },
        });

        if (outcome.kind === 'provider_error') {
          log({ evt: 'provider_error', attempt: 1, message: `stream aborted: ${outcome.message}` });
          send('error', CLIENT_ERROR);
          return;
        }

        if (outcome.kind === 'unsafe') {
          // Both events, deliberately: `safety_reject` is what the existing
          // dashboards count, and `used_fallback` is what tells them a learner
          // actually saw canned text. The non-streaming path emits the same
          // pair, so the two transports are comparable in the same query.
          log({ evt: 'safety_reject', attempt: 1, reasons: outcome.reasons });
          log({ evt: 'used_fallback', reason: 'safety' });
          send('fallback', { reply: opts.fallbackReply });
          await opts.finalizeFallback();
          return;
        }

        // Warn-only, exactly as generateValidated has it: the level check has
        // never affected control flow and must not start to here, or a reply
        // the learner has already read would be retracted for being slightly
        // too hard.
        validateContentLevel(outcome.rawText, language, targetLevel, { functionName: 'ai-chat' });

        send('done', await opts.finalize(outcome.rawText));
      } catch (err) {
        // Includes ProviderTimeoutError. The learner keeps whatever sentences
        // already arrived; the client decides whether to offer a retry.
        console.error('[ai-chat] stream failed:', err instanceof Error ? err.message : String(err));
        send('error', CLIENT_ERROR);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
