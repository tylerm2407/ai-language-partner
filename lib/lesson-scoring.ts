/**
 * The one place a lesson's final numbers are computed.
 *
 * They used to be computed three times — once for the result payload, once for
 * the celebration overlay, and once again by the screen that writes the
 * completion row. Skipping changes the formula, and three copies of a formula
 * is three chances to disagree about what a learner scored.
 */
import type { AttemptStatusMap } from './lesson-attempts';

export interface LessonSummary {
  /** Every exercise in the lesson, skipped ones included. */
  totalExercises: number;
  skippedCount: number;
  /** totalExercises - skippedCount. This is the accuracy denominator. */
  scoredCount: number;
  /** Right on the first attempt. A `recovered` answer is deliberately not here. */
  correctCount: number;
  accuracy: number;
  xpEarned: number;
  perfect: boolean;
}

export function summarizeLesson(
  statuses: AttemptStatusMap,
  exerciseIds: readonly string[],
  xpReward: number,
): LessonSummary {
  const totalExercises = exerciseIds.length;
  const skippedCount = exerciseIds.filter((id) => statuses[id] === 'skipped').length;
  const scoredCount = totalExercises - skippedCount;
  const correctCount = exerciseIds.filter((id) => statuses[id] === 'correct').length;

  // Skipping is neutral, so it leaves the denominator rather than counting
  // against it. A question the learner could not hear is not a question they
  // got wrong.
  const accuracy = scoredCount > 0 ? correctCount / scoredCount : 0;

  /**
   * XP is accuracy times engagement.
   *
   * Because skipping is neutral for accuracy, a lesson skipped down to one
   * lucky question would otherwise read as 100% and pay full XP. Multiplying
   * by the share of the lesson actually attempted closes that without
   * introducing a threshold to argue about or a cliff to game: skip 2 of 12
   * and ace the rest and you keep 83% of the XP; skip 11 of 12 and you keep 8%.
   */
  const engagement = totalExercises > 0 ? scoredCount / totalExercises : 0;

  return {
    totalExercises,
    skippedCount,
    scoredCount,
    correctCount,
    accuracy,
    xpEarned: Math.round(xpReward * accuracy * engagement),
    // "Flawless" has to mean the whole lesson. Without the skip clause,
    // skipping eleven of twelve and getting the last one right prints it.
    perfect: scoredCount > 0 && skippedCount === 0 && correctCount === scoredCount,
  };
}
