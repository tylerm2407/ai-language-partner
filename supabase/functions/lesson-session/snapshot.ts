/**
 * Mid-lesson snapshot shape + validation, shared by the edge function and its
 * tests. Kept out of index.ts so it can be tested without `serve()`.
 *
 * The wire shape mirrors lib/lesson-session-storage.ts on the client. Both
 * sides enforce the same one-day life so a snapshot can never outlive its day
 * on one side and be restored from the other.
 */

/** A started-but-unfinished lesson survives exactly one day. */
export const LESSON_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const LESSON_SESSION_SCHEMA_VERSION = 1;

/** Guard rails on a snapshot — a lesson is 10-15 exercises plus warm-up. */
export const MAX_SNAPSHOT_ANSWERS = 200;
export const MAX_ANSWER_TEXT_CHARS = 2000;
export const MAX_EXERCISE_ID_CHARS = 128;

export interface LessonSessionAnswer {
  exerciseId: string;
  correct: boolean;
  answer: string;
}

/**
 * Where one exercise stands. Mirrors AttemptStatus in lib/lesson-attempts.ts
 * on the client — kept as a literal list here because this module is the trust
 * boundary and must not accept a status it does not recognise.
 */
export type AttemptStatus =
  | 'unanswered'
  | 'retrying'
  | 'correct'
  | 'recovered'
  | 'wrong'
  | 'skipped';

const ATTEMPT_STATUSES: readonly string[] = [
  'unanswered', 'retrying', 'correct', 'recovered', 'wrong', 'skipped',
];

export interface LessonSessionSnapshot {
  version: number;
  exerciseIndex: number;
  answers: LessonSessionAnswer[];
  picks: Record<string, string>;
  /**
   * Per-exercise status. Optional on the wire, and deliberately NOT a schema
   * version bump: this module rejects a foreign version outright, so bumping
   * would delete every in-flight lesson on upgrade. An older client simply
   * sends no statuses and gets none back.
   */
  statuses: Record<string, AttemptStatus>;
  /** Epoch ms when the lesson session first started — the TTL reference. */
  startedAt: number;
}

/** Seconds left before a session that started at `startedAt` expires. */
export function remainingTtlSeconds(startedAt: number, now: number): number {
  return Math.floor((startedAt + LESSON_SESSION_TTL_MS - now) / 1000);
}

export function lessonSessionRedisKey(userId: string, lessonId: string): string {
  return `lesson-session:${userId}:${lessonId}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validate + normalise an untrusted snapshot. Returns null when the payload
 * is unusable — callers treat that as "no session", which restarts the
 * lesson rather than restoring something malformed.
 *
 * Normalising (rather than accepting as-is) matters because this value is
 * written back to the client on load: truncating here bounds what a caller
 * can park in Redis under their own key.
 */
export function parseSnapshot(value: unknown): LessonSessionSnapshot | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;

  if (v.version !== LESSON_SESSION_SCHEMA_VERSION) return null;
  if (!isFiniteNumber(v.exerciseIndex) || v.exerciseIndex < 0) return null;
  // A startedAt in the future would buy more than a day of life.
  if (!isFiniteNumber(v.startedAt) || v.startedAt <= 0 || v.startedAt > Date.now() + 60_000) {
    return null;
  }
  if (!Array.isArray(v.answers)) return null;
  if (v.answers.length > MAX_SNAPSHOT_ANSWERS) return null;

  const answers: LessonSessionAnswer[] = [];
  for (const entry of v.answers) {
    if (typeof entry !== 'object' || entry === null) return null;
    const a = entry as Record<string, unknown>;
    if (typeof a.exerciseId !== 'string' || a.exerciseId.length === 0) return null;
    if (typeof a.correct !== 'boolean') return null;
    if (typeof a.answer !== 'string') return null;
    answers.push({
      exerciseId: a.exerciseId.slice(0, MAX_EXERCISE_ID_CHARS),
      correct: a.correct,
      answer: a.answer.slice(0, MAX_ANSWER_TEXT_CHARS),
    });
  }

  const picks: Record<string, string> = {};
  if (v.picks !== undefined) {
    if (typeof v.picks !== 'object' || v.picks === null || Array.isArray(v.picks)) return null;
    const entries = Object.entries(v.picks as Record<string, unknown>);
    if (entries.length > MAX_SNAPSHOT_ANSWERS) return null;
    for (const [exerciseId, pick] of entries) {
      if (typeof pick !== 'string') return null;
      picks[exerciseId.slice(0, MAX_EXERCISE_ID_CHARS)] = pick.slice(0, MAX_ANSWER_TEXT_CHARS);
    }
  }

  const statuses: Record<string, AttemptStatus> = {};
  if (v.statuses !== undefined) {
    if (typeof v.statuses !== 'object' || v.statuses === null || Array.isArray(v.statuses)) {
      return null;
    }
    const entries = Object.entries(v.statuses as Record<string, unknown>);
    if (entries.length > MAX_SNAPSHOT_ANSWERS) return null;
    for (const [exerciseId, status] of entries) {
      // A status this server does not know is DROPPED, not rejected. A newer
      // client that adds a seventh status must not be able to wipe a learner's
      // in-flight lesson just by mentioning it.
      if (typeof status !== 'string' || !ATTEMPT_STATUSES.includes(status)) continue;
      statuses[exerciseId.slice(0, MAX_EXERCISE_ID_CHARS)] = status as AttemptStatus;
    }
  }

  return {
    version: LESSON_SESSION_SCHEMA_VERSION,
    exerciseIndex: Math.floor(v.exerciseIndex),
    answers,
    picks,
    statuses,
    startedAt: Math.floor(v.startedAt),
  };
}
