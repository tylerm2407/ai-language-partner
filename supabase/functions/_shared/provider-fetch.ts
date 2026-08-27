/**
 * One outbound call to a paid provider, with a deadline.
 *
 * Why this exists: `fetch` has no default timeout. A provider that accepts the
 * connection and then stops talking holds the isolate open until the platform
 * wall-clock limit kills it — and a platform kill is not an error the function
 * can catch, so the caller's retry never runs, the fallback never runs, and the
 * client sees a dead socket instead of a 502 it could act on. Everything the
 * repo already does right (retry, pre-authored fallback, honest error codes)
 * depends on the request actually *returning*.
 *
 * The budgets are per call shape, not one global number, because the shapes are
 * genuinely different: an 80-token hint and a 3,000-character narration have
 * nothing to say to each other. Each is set well above the observed p99 for
 * that call and well below the platform limit, so a timeout means "this one is
 * not coming back", never "this one is merely slow".
 *
 * `AbortSignal.timeout` covers the whole exchange, not just the connect —
 * a provider that streams a response body slowly is the failure mode that a
 * connect-only timeout misses.
 */

/**
 * Deadlines by call shape, in milliseconds.
 *
 * Sized against `max_tokens` for text and against input length for audio,
 * since those are what actually set the tail.
 */
export const PROVIDER_TIMEOUT_MS = {
  /** Short structured completions — hints (80 tok), turn analysis (150 tok),
   *  translations (300 tok). These are on a learner's critical path. */
  textShort: 20_000,
  /** Conversational completions — chat replies, conversation grading (600 tok).
   *  Someone is watching a typing indicator; past this they have given up. */
  text: 30_000,
  /** Long generations — stories (2,000 tok), exercise batches (2,048 tok),
   *  writing grades (1,500 tok), news articles (1,800 tok). Slower by design
   *  and mostly not on an interactive path. */
  textLong: 60_000,
  /** Whisper. The upload is up to 10MB of base64-decoded audio, so the
   *  transfer is a real part of the budget, not just the inference. */
  transcription: 60_000,
  /** Interactive speech synthesis — a chat reply or a lesson clip, capped at
   *  2,000 characters upstream. */
  speech: 45_000,
  /** Pre-rendered narration, up to 3,000 characters, produced by cron. Nobody
   *  is waiting, and a retry costs a whole day's podcast — so this one gets
   *  room rather than a tight leash. */
  narration: 120_000,
} as const;

/**
 * Raised when a provider misses its deadline. Distinct from a provider error
 * response so callers can tell "no answer" from "an answer we did not like" —
 * only the first is worth an immediate retry against the same provider.
 */
export class ProviderTimeoutError extends Error {
  constructor(public readonly provider: string, public readonly timeoutMs: number) {
    super(`${provider} did not respond within ${timeoutMs}ms`);
    this.name = 'ProviderTimeoutError';
  }
}

/**
 * `fetch` with a deadline.
 *
 * The signal is owned here — do not pass one in `init`, it would be replaced.
 * Anything other than a timeout (DNS, TLS, connection reset) propagates
 * unchanged, because those already reject on their own and the caller's
 * existing handling for them is correct.
 */
export async function providerFetch(
  url: string,
  init: RequestInit,
  opts: { provider: string; timeoutMs: number },
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(opts.timeoutMs) });
  } catch (err) {
    // Deno rejects an AbortSignal.timeout() abort with a TimeoutError
    // DOMException; older runtimes and manual controllers use AbortError.
    // Match on the name so this keeps working either way.
    const name = err instanceof Error ? err.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new ProviderTimeoutError(opts.provider, opts.timeoutMs);
    }
    throw err;
  }
}
