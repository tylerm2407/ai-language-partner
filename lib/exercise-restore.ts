/**
 * Rebuilding an exercise's graded state from the answer the learner already
 * gave.
 *
 * The lesson runner owns the pick map (`picks`, keyed by exercise id) so that
 * Previous can walk back onto an answered question. But each exercise
 * component keeps its own input and grade in local state, and the runner
 * remounts that component whenever the exercise changes — so on the way back
 * the component starts empty and the learner sees a blank, locked input under
 * a footer note that says they got it right.
 *
 * These helpers close that gap. Each component seeds its `useState` from the
 * recorded pick via a lazy initializer, which runs exactly once per mount:
 *
 *   const [answer, setAnswer] = useState(selected ?? '');
 *   const [submitted, setSubmitted] = useState(isRestored(selected));
 *   const [result, setResult] = useState(() => regradePick(exercise, selected));
 *
 * Re-grading rather than persisting the GradeResult is deliberate. The result
 * is a pure function of (answer, exercise), so recomputing it cannot drift
 * from what the learner originally saw, and it keeps the session snapshot to
 * the two things that are genuinely state: the answer and whether it was
 * right.
 */

import { gradeAnswer, type ExerciseHints, type GradeResult } from './grading';
import type { Exercise } from '../types';

/** The classifier hints every exercise passes to `gradeAnswer`. */
export function exerciseHints(exercise: Exercise): ExerciseHints {
  return {
    exerciseType: exercise.type,
    skillType: exercise.skillType,
    targetGrammar: exercise.targetGrammar,
    targetWord: exercise.targetWord,
  };
}

/** True when the runner handed back a previously recorded answer. */
export function isRestored(selected: string | null | undefined): selected is string {
  return selected !== null && selected !== undefined;
}

/**
 * Re-grade a restored pick, or `null` when there is nothing to restore.
 * Safe to call from a `useState` lazy initializer — pure, no side effects,
 * and notably no haptics: the buzz belongs to the moment of answering, not
 * to scrolling back through your own work.
 */
export function regradePick(
  exercise: Exercise,
  selected: string | null | undefined,
): GradeResult | null {
  if (!isRestored(selected)) return null;
  return gradeAnswer(selected, exercise.correctAnswer, exercise.acceptedAnswers, {
    exerciseHints: exerciseHints(exercise),
  });
}

/**
 * Split a composite answer back into its parts.
 *
 * Types that collect several inputs (collocation sets, dialogue blanks,
 * assembled sentences) report one joined string upward, because that is what
 * the runner's pick map and the session snapshot store. Restoring one means
 * splitting on the same separator it was built with.
 */
export function splitJoinedAnswer(
  selected: string | null | undefined,
  separator: string,
): string[] {
  if (!isRestored(selected) || selected === '') return [];
  return selected.split(separator);
}

/**
 * Map an assembled sentence back onto tile indices.
 *
 * Tiles can repeat ("de" twice in one sentence), so each index is consumed at
 * most once and matching walks left to right. If a word has no unused tile —
 * the tile set changed, or the answer came from a different shuffle — the
 * whole restore is abandoned rather than half-applied, which would put the
 * learner in a state they could not have built themselves.
 */
export function restorePlacedTiles(
  tiles: string[],
  selected: string | null | undefined,
): number[] {
  const words = splitJoinedAnswer(selected, ' ').filter((w) => w !== '');
  if (words.length === 0) return [];

  const used = new Set<number>();
  const placed: number[] = [];
  for (const word of words) {
    const index = tiles.findIndex((tile, i) => !used.has(i) && tile === word);
    if (index === -1) return [];
    used.add(index);
    placed.push(index);
  }
  return placed;
}

/**
 * Pull the score back out of a speaking answer (`score:82`).
 *
 * Speaking is the one type whose feedback cannot be rebuilt: the prose and
 * the transcription came from the scoring service, and only the number was
 * ever recorded. Callers restore the score and say so plainly rather than
 * inventing the evaluation that went with it.
 */
export function parseSpeakingScore(selected: string | null | undefined): number | null {
  if (!isRestored(selected)) return null;
  const match = /^score:(\d+(?:\.\d+)?)$/.exec(selected);
  if (!match) return null;
  const score = Number(match[1]);
  return Number.isFinite(score) ? score : null;
}

/**
 * The pass mark the scoring service itself applies
 * (supabase/functions/score-pronunciation/index.ts). It lives here so the
 * restore path and the live path cannot drift apart: the pick stores the
 * number, and pass/fail is recomputed from it — the same "re-grade, don't
 * store the grade" rule the rest of this module follows.
 */
export const SPEAKING_PASS_SCORE = 60;

/**
 * Did a restored speaking answer pass? `null` when there is nothing to
 * restore. The learner never sees the number (speaking is reported as a plain
 * correct/incorrect), but the number is still what gets stored, because it is
 * the raw observation rather than a verdict.
 */
export function speakingWasCorrect(selected: string | null | undefined): boolean | null {
  const score = parseSpeakingScore(selected);
  return score === null ? null : score >= SPEAKING_PASS_SCORE;
}
