/**
 * Per-exercise evidence for the proficiency report (migration 128).
 *
 * Every graded main-lesson exercise — card-linked or not — becomes one
 * `exercise_results` row through the `record_exercise_result` RPC. The SRS
 * path (lib/lesson-srs.ts) only sees exercises with a card behind them; this
 * is what records the rest, and in particular the listening types
 * (`listening_choice`, `listening_type`, `dictation`), which had no evidence
 * trail at all before this.
 *
 * Warm-up items are deliberately NOT recorded here. They are due SRS cards
 * with synthetic `warmup-…` ids, their review is already the `review_logs` row
 * the SRS path writes, and they do not belong to the lesson being graded.
 */
import * as Sentry from '@sentry/react-native';
import { recordExerciseResult } from './supabase-queries';
import { enqueue, isNetworkError, newClientResultId, type ExerciseResultPayload } from './offline-queue';

/**
 * The RPC derives everything from the `exercises` row, so only an id that can
 * BE a row is worth sending. The pre-auth trial lesson and the onboarding
 * topic packs run the same runner on hand-authored exercises whose ids are
 * plain strings; sending those would fail as "unknown exercise" on every
 * answer and page Sentry for a lesson that was never in the database.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDatabaseExerciseId(id: string): boolean {
  return UUID_RE.test(id);
}

export interface ExerciseEvidenceInput {
  /** First-attempt correctness — a recovered second attempt is `false`. */
  correct: boolean;
  /** Attempts spent: 1 for a clean answer, 2 for recovered / wrong-after-retry. */
  attempts: number;
  /** Milliseconds from the exercise being shown to the resolving answer. */
  responseTimeMs: number;
}

export type ExerciseEvidenceResult =
  | { status: 'written' }
  | { status: 'queued' }
  | { status: 'skipped'; reason: 'no-user' | 'not-a-row' };

/** Server clamp is 1–5 (migration 128); mirrored so the queue never stores a value the RPC will reject. */
const MAX_ATTEMPTS = 5;

/**
 * Record one graded exercise. Never blocks grading: callers fire-and-forget
 * and route the rejection through `reportLessonWriteFailure`.
 *
 * A network error queues the exact payload — including the client-minted id,
 * so the replay is the same result rather than a second one. Anything else
 * propagates: a permission or schema failure must surface, not be retried for
 * a week.
 */
export async function recordExerciseEvidence(
  userId: string,
  exerciseId: string,
  input: ExerciseEvidenceInput,
): Promise<ExerciseEvidenceResult> {
  if (!userId) return { status: 'skipped', reason: 'no-user' };
  if (!isDatabaseExerciseId(exerciseId)) return { status: 'skipped', reason: 'not-a-row' };

  const payload: ExerciseResultPayload = {
    exerciseId,
    correct: input.correct,
    attempts: Math.max(1, Math.min(MAX_ATTEMPTS, Math.round(input.attempts))),
    responseTimeMs: Math.max(0, Math.round(input.responseTimeMs)),
    clientResultId: newClientResultId(),
  };

  try {
    await recordExerciseResult(payload);
    return { status: 'written' };
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    console.warn('[lesson-evidence] offline; queueing exercise result for', exerciseId);
    await enqueue(userId, { type: 'exercise-result', payload });
    return { status: 'queued' };
  }
}

/**
 * What a lesson write failure that reached the runner gets: the console line
 * it always had, plus a Sentry event when it is NOT a network failure.
 *
 * Network failures are handled below this point — queued for replay, or
 * skipped with a reason the runner surfaces — so one that still escapes is
 * the queue itself failing, which the offline queue already reports. A
 * non-network failure is a bug (a schema change, a revoked grant, a bad
 * payload) that used to end in a bare console.warn nobody reads on a phone.
 */
export function reportLessonWriteFailure(what: string, err: unknown): void {
  console.warn(`[lesson-srs] ${what} failed:`, err);
  if (isNetworkError(err)) return;
  Sentry.captureException(err, { tags: { area: 'lesson-srs' }, extra: { what } });
}
