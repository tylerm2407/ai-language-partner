// Pure orchestration for the translate edge function: one retry on
// transient API failure, content-safety validation of the output, and the
// rule that decides which daily counter a request is charged against.
// No Deno.env / serve() so it can be unit tested (see translate.test.ts).

import { validateContentSafety } from '../_shared/content-safety.ts';

/**
 * Longest input the cheap `word_lookups` counter will accept.
 *
 * 40 characters clears the longest word a learner is realistically tapping —
 * German compounds and Spanish superlatives both fit — while staying far
 * enough below MAX_INPUT_CHARS that the two counters cannot be confused for
 * each other.
 */
export const MAX_WORD_LOOKUP_CHARS = 40;

export type QuotaCounter = 'translations' | 'word_lookups';

export type CounterDecision =
  | { ok: true; counter: QuotaCounter }
  | { ok: false; code: 'NOT_A_WORD' };

/**
 * Which daily counter this request is charged against.
 *
 * `word_lookups` (migration 094) is a much larger allowance than
 * `translations`, because a reading lookup is one word rather than up to 1500
 * characters of chat. That difference is the whole reason the caller may ask
 * for it — so the cheap counter is only granted to input that really is one
 * word. Whitespace of any kind, or anything over MAX_WORD_LOOKUP_CHARS, is
 * refused outright rather than quietly billed to `translations`: silently
 * charging a different meter than the client asked for would make the
 * remaining count it shows the learner wrong.
 *
 * Note the check is on whitespace, not on letters. `l'homme`, `sans-culotte`
 * and `¿qué?` are all one tapped token and all pass.
 */
export function resolveQuotaCounter(text: string, purpose: unknown): CounterDecision {
  if (purpose !== 'word_lookup') return { ok: true, counter: 'translations' };

  const word = text.trim();
  if (!word || word.length > MAX_WORD_LOOKUP_CHARS || /\s/.test(word)) {
    return { ok: false, code: 'NOT_A_WORD' };
  }
  return { ok: true, counter: 'word_lookups' };
}

export type TranslateOutcome =
  | { ok: true; translation: string }
  | { ok: false; reason: 'api_error' | 'unsafe' };

/**
 * Run `callApi` (a single Anthropic request returning the raw translation;
 * throws on API failure) with one retry. Each successful call's output is
 * safety-validated; unsafe output also consumes the retry (regenerate once).
 * There is no pre-authored fallback for arbitrary translations — persistent
 * failure returns { ok: false } and the caller responds with an honest 502.
 */
export async function translateWithValidation(
  callApi: () => Promise<string>,
  language?: string,
  log: (evt: Record<string, unknown>) => void = (e) =>
    console.log(JSON.stringify({ ...e, ts: new Date().toISOString() })),
): Promise<TranslateOutcome> {
  let lastReason: 'api_error' | 'unsafe' = 'api_error';

  for (let attempt = 1; attempt <= 2; attempt++) {
    let text: string;
    try {
      text = await callApi();
    } catch (err) {
      lastReason = 'api_error';
      log({
        evt: 'api_error',
        fn: 'translate',
        attempt,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    const safety = await validateContentSafety(text, { language, fn: 'translate' });
    if (safety.safe) return { ok: true, translation: text };

    lastReason = 'unsafe';
    log({ evt: 'safety_reject', fn: 'translate', attempt, reasons: safety.reasons, language });
  }

  return { ok: false, reason: lastReason };
}
