// Pure orchestration for the translate edge function: one retry on
// transient API failure, content-safety validation of the output.
// No Deno.env / serve() so it can be unit tested (see translate.test.ts).

import { validateContentSafety } from '../_shared/content-safety.ts';

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
