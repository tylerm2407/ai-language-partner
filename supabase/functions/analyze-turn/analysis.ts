// Pure helpers for the analyze-turn edge function: parse the model's JSON
// analysis and orchestrate retry-then-degraded. No Deno.env / serve() so
// they can be unit tested (see analyze-turn.test.ts).

import { validateContentSafety } from '../_shared/content-safety.ts';

export interface TurnAnalysis {
  correction: string | null;
  vocabularyHighlights: string[];
}

/**
 * Strip markdown code fences and parse the model's analysis JSON.
 * Returns null when the text is not a usable analysis object — distinct
 * from a valid "nothing to flag" result ({ correction: null, ... }).
 */
export function parseTurnAnalysis(raw: string): TurnAnalysis | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    const correction =
      typeof obj.correction === 'string' && obj.correction.trim() ? obj.correction : null;
    const vocabularyHighlights = Array.isArray(obj.vocabularyHighlights)
      ? obj.vocabularyHighlights.filter((w: unknown): w is string => typeof w === 'string')
      : [];
    return { correction, vocabularyHighlights };
  } catch {
    return null;
  }
}

/**
 * Call the model with one retry. An attempt fails on API error (callApi
 * throws), unparseable output, or an unsafe correction text — the
 * correction is user-visible AI output, so it must pass content safety
 * before we return it (a null correction has nothing to check). Returns
 * null when both attempts fail — the caller responds with an explicit
 * error status instead of silently returning empty data (network failure
 * must be distinguishable from "no correction needed").
 */
export async function analyzeTurnWithRetry(
  callApi: () => Promise<string>,
  log: (evt: Record<string, unknown>) => void = (e) =>
    console.log(JSON.stringify({ ...e, ts: new Date().toISOString() })),
): Promise<TurnAnalysis | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await callApi();
      const parsed = parseTurnAnalysis(raw);
      if (!parsed) {
        log({ evt: 'parse_failure', fn: 'analyze-turn', attempt });
        continue;
      }
      if (parsed.correction) {
        const safety = await validateContentSafety(parsed.correction, { fn: 'analyze-turn' });
        if (!safety.safe) {
          log({ evt: 'safety_reject', fn: 'analyze-turn', attempt, reasons: safety.reasons });
          continue;
        }
      }
      return parsed;
    } catch (err) {
      log({
        evt: 'api_error',
        fn: 'analyze-turn',
        attempt,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return null;
}
