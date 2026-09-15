/**
 * AI semantic grading for OPEN responses.
 *
 * Two surfaces send free text against a key that cannot enumerate every right
 * answer: a lesson `free_production` sentence and a reading `short_answer`.
 * String matching there fails honest learners ("con mi hermana" for a key that
 * happens to say "hermano") and passes wrong ones by typo distance. Authorised
 * by the user decision of 2026-09-14, those two — and only those two — may ask
 * the `grade-response` edge function for a meaning-based verdict.
 *
 * Order, and why:
 *   1. Fixed key on the device via `gradeAnswer` (free, instant). A match ends
 *      here and never costs a call.
 *   2. The edge function, which re-runs the fixed check, meters the call on its
 *      own daily counter (NOT the paid writing quota), and grades through
 *      `generateValidated` so the output is safety-checked.
 *   3. If the function cannot answer — network, provider outage, the day's
 *      allowance spent — the fixed result is used and the result says so
 *      (`source: 'fixed_fallback'`, `fallbackReason`). The UI shows that note;
 *      the failure is surfaced, never swallowed.
 *
 * `gradeToRating` is untouched: a semantic verdict is expressed as a normal
 * `GradeResult`, with `partial` carrying an accuracy that lands on the existing
 * "close" rating.
 */

import { gradeAnswer, type ExerciseHints, type GradeResult } from './grading';
// Pulls in the supabase client. Component tests that render an exercise which
// imports this module mock '../../lib/ai', as the lesson tests already do.
import { invokeWithRetry } from './ai';
import type { LanguageCode } from '../types';

/** The two open-response surfaces. Mirrors OPEN_RESPONSE_KINDS server-side. */
export type OpenResponseKind = 'free_production' | 'short_answer';

export type GradeSource = 'fixed' | 'semantic' | 'fixed_fallback';
export type SemanticVerdict = 'correct' | 'partial' | 'incorrect';

export interface OpenGradeResult extends GradeResult {
  source: GradeSource;
  verdict: SemanticVerdict;
  /** The grader's one-line, learner-safe reason. Semantic results only. */
  reason?: string;
  /**
   * Why the semantic grader did not answer. Set only when `source` is
   * `fixed_fallback`, and always shown to the learner as a "checked offline"
   * note — a silent downgrade would present a string match as a judgement.
   */
  fallbackReason?: string;
}

interface OpenResponseBase {
  answer: string;
  key: string;
  alternatives?: string[];
  /** Learner's CEFR level; shapes the rubric's tolerance. */
  level: string;
  /** The exercise prompt, sent as reference so "on task" can be judged. */
  promptText?: string;
  exerciseHints?: ExerciseHints;
}

/**
 * A union, not an optional pair, so the reading path CANNOT send a language.
 *
 * The rubric marks a right answer given in the wrong language incorrect, so the
 * grading language must come from the content, never from the learner's current
 * profile — a target-language switch would otherwise fail every correct answer
 * to an older passage. A lesson carries its course language down from the
 * runner, which refuses to grade before the profile loads. A reading passage
 * has no language on the row at all, so it sends `passageId` and the edge
 * function reads the language from the passage's course.
 */
export type OpenResponseArgs =
  | (OpenResponseBase & { kind: 'free_production'; language: LanguageCode })
  | (OpenResponseBase & { kind: 'short_answer'; passageId: string });

/**
 * Accuracy assigned to a `partial` verdict. Above `gradeToRating`'s 0.5 line,
 * so a partial answer is rated 2 ("close") rather than 1 ("total miss") —
 * without changing that function.
 */
export const PARTIAL_ACCURACY = 0.7;

export const FUNCTION_NAME = 'grade-response';

interface GradeResponseBody {
  verdict?: unknown;
  reason?: unknown;
  normalizedAnswer?: unknown;
  source?: unknown;
  error?: unknown;
}

function isVerdict(value: unknown): value is SemanticVerdict {
  return value === 'correct' || value === 'partial' || value === 'incorrect';
}

/** Pull the function's own error message and code out of an invoke error. */
async function describeInvokeError(error: unknown): Promise<string> {
  let detail = String((error as { message?: string })?.message ?? 'unknown error');
  try {
    const ctx = (error as Record<string, unknown>).context;
    if (ctx && typeof (ctx as Response).json === 'function') {
      const body = (await (ctx as Response).json()) as { error?: unknown; code?: unknown };
      if (typeof body?.error === 'string') detail = body.error;
      if (typeof body?.code === 'string') detail = `${detail} [${body.code}]`;
    }
  } catch {
    // The body was not JSON — the generic message stands. Not a swallow: the
    // detail is returned and shown.
  }
  return detail;
}

function withFixed(fixed: GradeResult, source: GradeSource, fallbackReason?: string): OpenGradeResult {
  return {
    ...fixed,
    source,
    verdict: fixed.isCorrect ? 'correct' : 'incorrect',
    ...(fallbackReason ? { fallbackReason } : {}),
  };
}

function fromVerdict(
  fixed: GradeResult,
  verdict: SemanticVerdict,
  reason: string,
  key: string,
): OpenGradeResult {
  const expected = `The expected answer was: ${key}`;
  if (verdict === 'correct') {
    return {
      ...fixed,
      isCorrect: true,
      accuracy: 1,
      feedback: reason || 'Correct!',
      errorType: null,
      source: 'semantic',
      verdict,
      reason,
    };
  }
  return {
    ...fixed,
    isCorrect: false,
    accuracy: verdict === 'partial' ? PARTIAL_ACCURACY : 0,
    feedback: reason ? `${reason} ${expected}` : `${verdict === 'partial' ? 'Almost!' : 'Incorrect.'} ${expected}`,
    // `null` on purpose: the feedback card's category branches carry their
    // own wording, and the grader's reason would be lost behind them.
    errorType: null,
    source: 'semantic',
    verdict,
    reason,
  };
}

/**
 * Grade an open response: fixed key first, then the semantic grader, then the
 * fixed result again — labelled — when the grader cannot answer. Never throws
 * for a remote failure; the failure is in the result.
 */
export async function gradeOpenResponse(args: OpenResponseArgs): Promise<OpenGradeResult> {
  const alternatives = args.alternatives ?? [];
  const fixed = gradeAnswer(args.answer, args.key, alternatives, {
    exerciseHints: args.exerciseHints,
  });
  if (fixed.isCorrect || !args.answer.trim()) return withFixed(fixed, 'fixed');

  const { data, error } = await invokeWithRetry<GradeResponseBody>(FUNCTION_NAME, {
    body: {
      answer: args.answer,
      key: args.key,
      alternatives,
      level: args.level,
      kind: args.kind,
      prompt: args.promptText ?? '',
      ...(args.kind === 'free_production'
        ? { language: args.language }
        : { passageId: args.passageId }),
    },
  });

  if (error) {
    const detail = await describeInvokeError(error);
    console.warn(`[semantic-grading] ${FUNCTION_NAME} failed, using the fixed key:`, detail);
    return withFixed(fixed, 'fixed_fallback', detail);
  }
  if (!data || typeof data !== 'object') {
    return withFixed(fixed, 'fixed_fallback', 'empty response');
  }
  if (typeof data.error === 'string') {
    console.warn(`[semantic-grading] ${FUNCTION_NAME} refused:`, data.error);
    return withFixed(fixed, 'fixed_fallback', data.error);
  }
  if (data.verdict === 'fallback') {
    // The server could not grade semantically (provider, safety, or the
    // day's allowance) and said so. Its `fixed` mirrors ours minus typo
    // tolerance, so the local fixed result — the more forgiving one — stands.
    const reason = typeof data.reason === 'string' ? data.reason : 'unavailable';
    return withFixed(fixed, 'fixed_fallback', reason);
  }
  if (!isVerdict(data.verdict)) {
    return withFixed(fixed, 'fixed_fallback', 'malformed response');
  }
  const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
  return fromVerdict(fixed, data.verdict, reason, args.key);
}

/**
 * Rebuild a restored open response's graded state.
 *
 * `lib/exercise-restore.ts` re-grades a restored pick from the key, which is
 * exact for every closed type. An open response the grader accepted would
 * come back "Incorrect" on Previous — so the runner hands over the status it
 * recorded, and that wins. Re-asking the grader would cost a call to learn
 * something we already know.
 */
export function restoreOpenGrade(
  fixed: GradeResult | null,
  recordedCorrect: boolean | null | undefined,
): GradeResult | null {
  // Only the "grader accepted, key would not" direction exists: a fixed match
  // is recorded correct without ever asking the grader, so the recorded
  // status can never be stricter than the key.
  if (!fixed || recordedCorrect !== true || fixed.isCorrect) return fixed;
  return { ...fixed, isCorrect: true, accuracy: 1, feedback: 'Correct!', errorType: null };
}

/** The note shown whenever the semantic grader did not decide. */
export const OFFLINE_CHECK_NOTE = 'Checked offline against the model answer only — the AI check was not available.';

/** Shown when the day's AI checks are spent. Not an outage, and not the
 *  learner's mistake — so it says which it is and what still happened. */
export const QUOTA_CHECK_NOTE =
  "You've used today's AI checks. Checked against the model answer only.";

/** Shown when the learner is answering faster than the burst window allows. */
export const BUSY_CHECK_NOTE =
  'Checked against the model answer only — the AI check was busy. Try the next one in a moment.';

/**
 * The learner-facing note for a fallback.
 *
 * `fallbackReason` can be a server code ('quota', 'provider', 'safety',
 * 'language') or free text recovered from a failed invoke. Only known codes
 * get specific wording; anything else falls back to the generic note, because
 * raw server/transport text is not learner copy and must not be rendered.
 */
export function fallbackNote(fallbackReason?: string): string {
  if (!fallbackReason) return OFFLINE_CHECK_NOTE;
  if (fallbackReason === 'quota') return QUOTA_CHECK_NOTE;
  if (fallbackReason.includes('RATE_LIMITED')) return BUSY_CHECK_NOTE;
  return OFFLINE_CHECK_NOTE;
}
