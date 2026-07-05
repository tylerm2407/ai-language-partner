// Pure grading helpers for the grade-writing edge function.
// Kept free of Deno.env / serve() so they can be unit tested without
// booting the function (see grade-writing.test.ts).

import { generateValidated } from '../_shared/validated-generate.ts';

/**
 * Grading feedback payload returned to the client. Shape is intentionally
 * loose (the model may include extra fields; the client reads a known
 * subset) — but `graded` is always present:
 *   - graded: true  → real AI grade
 *   - graded: false → pre-authored fallback, NO score was assigned
 */
export type GradingFeedback = Record<string, unknown> & { graded: boolean };

/**
 * Honest no-grade fallback. All scores are 0 (the client's overall-score
 * averaging filters out zeros, so nothing fake is persisted), feedback text
 * states that AI grading was unavailable, and `graded: false` lets clients
 * distinguish this from a real grade.
 */
export function buildFallbackFeedback(): GradingFeedback {
  return {
    grammar: 0,
    vocabulary: 0,
    coherence: 0,
    task_completion: 0,
    total: 0,
    grammarScore: 0,
    vocabularyScore: 0,
    coherenceScore: 0,
    spellingScore: 0,
    sentenceStructureScore: 0,
    strengths: [],
    improvements: [
      'Re-read your text once, checking verb tenses and agreement.',
      'Double-check spelling and accents.',
      'Make sure every sentence addresses the writing prompt.',
    ],
    correctedVersion: null,
    corrections: [],
    overallFeedback:
      'Detailed AI feedback is unavailable right now, so no score was assigned for this attempt. Your submission was saved — please try grading it again in a few minutes.',
    graded: false,
  };
}

/**
 * Strip markdown code fences and parse the model's grading JSON.
 * Returns null when the text is not a usable grading object (the client
 * requires numeric grammarScore / vocabularyScore / coherenceScore).
 */
export function parseGradingResponse(raw: string): GradingFeedback | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  const candidates = [cleaned];
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (isGradingObject(parsed)) {
        return { ...(parsed as Record<string, unknown>), graded: true };
      }
    } catch {
      // Try the next candidate; a null return signals parse failure upstream.
    }
  }
  return null;
}

function isGradingObject(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return ['grammarScore', 'vocabularyScore', 'coherenceScore'].every(
    (key) => typeof obj[key] === 'number' && Number.isFinite(obj[key] as number),
  );
}

/**
 * Full grading orchestration: safety (via generateValidated: retry →
 * safety-retry → fallback) plus a one-shot retry on unparseable JSON.
 *
 *   parse attempt 1: full safety-retry budget (2 regenerations)
 *   parse attempt 2: one more generation, no safety retries (cheap)
 *   still unusable → honest fallback (graded: false), never fake scores
 *
 * `callModel` throws on API failure — that propagates to the caller's
 * error handler (house pattern; same as ai-chat).
 */
export async function gradeWithValidation(
  callModel: () => Promise<string>,
  log: (evt: Record<string, unknown>) => void = (e) =>
    console.log(JSON.stringify({ ...e, ts: new Date().toISOString() })),
): Promise<GradingFeedback> {
  const fallbackFeedback = buildFallbackFeedback();

  for (let parseAttempt = 1; parseAttempt <= 2; parseAttempt++) {
    const result = await generateValidated({
      fn: 'grade-writing',
      language: 'en',
      // Feedback is English meta-text, not learner-level target-language
      // content — CEFR level check does not apply.
      skipLevelCheck: true,
      safetyRetries: parseAttempt === 1 ? 2 : 0,
      generate: callModel,
      fallback: () => Promise.resolve(JSON.stringify(fallbackFeedback)),
    });

    // Safety retries exhausted — generateValidated already logged used_fallback.
    if (result.usedFallback) return fallbackFeedback;

    const parsed = parseGradingResponse(result.text);
    if (parsed) return parsed;

    log({ evt: 'parse_failure', fn: 'grade-writing', attempt: parseAttempt });
  }

  log({ evt: 'used_fallback', fn: 'grade-writing', reason: 'parse' });
  return fallbackFeedback;
}
