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
 * Honest no-grade fallback. Numeric fields retain the legacy payload shape,
 * but `graded: false` means no score: clients persist a null overall score,
 * display "Not graded", and do not award scored-writing XP.
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
 * Fresh model output must contain the complete task rubric and safe display
 * fields. Compatibility with older stored feedback belongs to the client,
 * not this boundary: missing assessment fields must trigger retry/fallback.
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
        // The total is arithmetic, not a separate model judgment.
        parsed.total = parsed.grammar + parsed.vocabulary + parsed.coherence + parsed.task_completion;
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
  const validScore = (value: unknown, maximum: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum;
  if (!['grammarScore', 'vocabularyScore', 'coherenceScore', 'spellingScore', 'sentenceStructureScore'].every(key => validScore(obj[key], 100))) return false;
  const rubric = ['grammar', 'vocabulary', 'coherence', 'task_completion'];
  if (!rubric.every(key => validScore(obj[key], 25))) return false;
  if (obj.graded !== undefined && obj.graded !== true) return false;

  const stringList = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string');
  if (!stringList(obj.strengths) || !stringList(obj.improvements)) return false;
  if (typeof obj.overallFeedback !== 'string' || !obj.overallFeedback.trim()) return false;
  if (obj.correctedVersion !== null && typeof obj.correctedVersion !== 'string') return false;
  if (!Array.isArray(obj.corrections)) return false;
  return obj.corrections.every(value => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const correction = value as Record<string, unknown>;
    // Empty source/replacement spans can represent a genuine insertion or
    // deletion. Do not require a correction, or manufacture one for good text.
    return ['original', 'corrected', 'explanation'].every(key => typeof correction[key] === 'string')
      && typeof correction.type === 'string'
      && ['grammar', 'vocabulary', 'spelling', 'style', 'structure'].includes(correction.type)
      && (correction.ruleViolated === undefined || typeof correction.ruleViolated === 'string');
  });
}

/**
 * Whether the consumed writing_grades quota should be refunded: only when
 * the honest no-grade fallback shipped (graded: false). A real grade —
 * however low — keeps the quota consumed.
 */
export function shouldRefundQuota(
  feedback: GradingFeedback,
  fallbackReason?: GradeFallbackReason,
): boolean {
  // A safety rejection is not refundable: the model was called, up to three
  // times, and the submission is what the corrected version echoes back. A
  // refund there made "kill" or a URL in the text a free grade, forever.
  return feedback.graded === false && fallbackReason !== 'safety';
}

/** Why the no-grade fallback shipped. `parse` is a model that answered but
 *  not in JSON; `provider` is no answer; `safety` is an answer we would not
 *  show, which the learner's own text drove. */
export type GradeFallbackReason = 'safety' | 'provider' | 'parse';

export interface GradeOutcome {
  feedback: GradingFeedback;
  /** Present only when `feedback.graded` is false. */
  fallbackReason?: GradeFallbackReason;
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
): Promise<GradeOutcome> {
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
    if (result.usedFallback) {
      return { feedback: fallbackFeedback, fallbackReason: result.fallbackReason ?? 'provider' };
    }

    const parsed = parseGradingResponse(result.text);
    if (parsed) return { feedback: parsed };

    log({ evt: 'parse_failure', fn: 'grade-writing', attempt: parseAttempt });
  }

  log({ evt: 'used_fallback', fn: 'grade-writing', reason: 'parse' });
  return { feedback: fallbackFeedback, fallbackReason: 'parse' };
}
