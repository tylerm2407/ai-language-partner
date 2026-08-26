/**
 * Where each exercise in a lesson stands, and the rules that move it there.
 *
 * This is the model behind the second-chance rule: a wrong answer buys one
 * more attempt with the answer still hidden, and getting it right on that
 * second attempt teaches without scoring. The runner owns this state rather
 * than the individual exercise components, because the runner is the only
 * thing that can unlock a component's input — every component gates its input
 * on the `showResult` prop the runner passes down.
 */
import type { Exercise, ExerciseType } from '../types';

/** Ordered by the transitions that produce them. */
export type AttemptStatus =
  | 'unanswered'
  | 'retrying'   // attempt 1 was wrong; attempt 2 is open; nothing revealed yet
  | 'correct'    // right first time — the only status that scores
  | 'recovered'  // right on the second attempt — does not score, SRS rating 3
  | 'wrong'      // out of attempts, or gave up and asked to see the answer
  | 'skipped';   // neutral: no score, no heart, no SRS write

export type AttemptStatusMap = Record<string, AttemptStatus>;

export const ATTEMPT_STATUSES: readonly AttemptStatus[] = [
  'unanswered', 'retrying', 'correct', 'recovered', 'wrong', 'skipped',
];

export function isAttemptStatus(value: unknown): value is AttemptStatus {
  return typeof value === 'string' && (ATTEMPT_STATUSES as readonly string[]).includes(value);
}

/** The runner is done with this exercise, so Next is allowed. */
export function isResolved(status: AttemptStatus): boolean {
  return status === 'correct' || status === 'recovered' || status === 'wrong' || status === 'skipped';
}

/**
 * The exercise component must render its input read-only.
 *
 * A skipped exercise is deliberately NOT locked. The usual reason to skip a
 * listening item is that the learner cannot hear right now; when they can,
 * walking back to it must give them a real attempt rather than a locked
 * question with a dash next to it.
 */
export function isLocked(status: AttemptStatus): boolean {
  return status === 'correct' || status === 'recovered' || status === 'wrong';
}

/**
 * Whether the correct answer may be shown.
 *
 * Not while retrying — that is the entire point of the second attempt. And not
 * on a skip either, or "skip" quietly becomes "show me the answer for free".
 */
export function revealsAnswer(status: AttemptStatus): boolean {
  return status === 'recovered' || status === 'wrong';
}

/**
 * Types that get one graded attempt rather than two.
 *
 * `speaking` is here because every graded attempt spends a unit of the daily
 * pronunciation-scoring allowance, and the type already offers an unlimited
 * *local* re-record loop before the learner commits — the second chance
 * already exists there, for free. It gets the Skip affordance instead.
 */
const SINGLE_ATTEMPT_TYPES: ReadonlySet<ExerciseType> = new Set<ExerciseType>(['speaking']);

/**
 * How many attempts this exercise gets.
 *
 * Warm-up items are always one. They are due SRS cards whose whole job is to
 * measure recall, so a second attempt would corrupt the very signal being
 * measured — and the warm-up does not feed lesson accuracy anyway.
 */
export function maxAttempts(type: ExerciseType, isWarmup: boolean): 1 | 2 {
  if (isWarmup) return 1;
  return SINGLE_ATTEMPT_TYPES.has(type) ? 1 : 2;
}

/**
 * Types whose INPUT CHANNEL can fail for reasons that have nothing to do with
 * knowing the language: no headphones, a loud train, a denied microphone
 * permission, an exhausted lesson-audio allowance, or a synthesis failure.
 *
 * Every other exercise type is answerable on a silent phone in a quiet room,
 * so none of them need an escape hatch. Scoring an environment problem as a
 * language error is exactly what the hands-free session's "not caught" rating
 * already exists to avoid.
 */
const SKIPPABLE_TYPES: ReadonlySet<ExerciseType> = new Set<ExerciseType>([
  'listening_choice',
  'listening_type',
  'speaking',
  'dictation',
]);

/** May this exercise be skipped? Warm-up items never can. */
export function canSkip(exercise: Exercise, isWarmup: boolean): boolean {
  return !isWarmup && SKIPPABLE_TYPES.has(exercise.type);
}

/** The status an answer produces, given how many attempts were already spent. */
export function nextStatus(
  correct: boolean,
  attemptsBefore: number,
  max: 1 | 2,
): AttemptStatus {
  if (correct) return attemptsBefore === 0 ? 'correct' : 'recovered';
  return attemptsBefore + 1 >= max ? 'wrong' : 'retrying';
}
