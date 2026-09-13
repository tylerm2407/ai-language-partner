/**
 * Goal-track progress: what the Learn card shows above its lesson list.
 *
 * A goal track has no progress table of its own (migration 099 made a track a
 * plain `courses` row so the lesson runner and SRS would work on it
 * unchanged), so its progress is derived from the learner's
 * `lesson_completions` for the track's lessons, fetched alongside the track.
 * The rollup lives here rather than in the card so it can be tested without
 * rendering anything, and so the Learn screen and the card agree on what
 * "next" means.
 */

import type { GoalTrack } from '../types';

export interface GoalLessonCompletion {
  /** 0-1, as `lesson_completions.score`. Null when the row carries none. */
  score: number | null;
  completedAt: string;
}

export type GoalTrackLesson = GoalTrack['lessons'][number] & {
  completion: GoalLessonCompletion | null;
};

/** A goal track with the learner's completions attached to its lessons. */
export interface GoalTrackProgress extends GoalTrack {
  lessons: GoalTrackLesson[];
}

/**
 * How one row on the card renders.
 *
 *   completed   — finished: check and score.
 *   next        — the primary tap target: the first unfinished lesson that can
 *                 be opened (ready, or a shell that is built on tap).
 *   open        — any other unfinished lesson the learner may open.
 *   generating  — somebody else is building it right now; not tappable.
 */
export type GoalLessonRowState = 'completed' | 'next' | 'open' | 'generating';

export interface GoalTrackSummary {
  doneCount: number;
  total: number;
  /** 0-1. Zero for an empty track rather than NaN. */
  progress: number;
  /** The `next` lesson's id, or null when every lesson is done or blocked. */
  nextLessonId: string | null;
}

/**
 * The first unfinished lesson that can be opened is "next". Lessons are
 * walked in order, so a learner who skipped ahead and finished lesson 3 is
 * still pointed back at lesson 1 — the track was planned so each lesson
 * builds on the last, and a gap is a gap.
 *
 * A `generating` lesson is skipped over rather than chosen: pointing the
 * primary target at a row that cannot be tapped would leave the card with no
 * call to action for as long as someone else's build takes.
 */
export function summarizeGoalTrack(lessons: readonly GoalTrackLesson[]): GoalTrackSummary {
  const total = lessons.length;
  const doneCount = lessons.filter((l) => l.completion !== null).length;
  const next = lessons.find((l) => l.completion === null && l.generationState !== 'generating');
  return {
    doneCount,
    total,
    progress: total === 0 ? 0 : doneCount / total,
    nextLessonId: next?.id ?? null,
  };
}

export function goalLessonRowState(
  lesson: GoalTrackLesson,
  nextLessonId: string | null,
): GoalLessonRowState {
  if (lesson.completion !== null) return 'completed';
  if (lesson.generationState === 'generating') return 'generating';
  return lesson.id === nextLessonId ? 'next' : 'open';
}

/** `94%` from a 0-1 score; the same rounding LessonRow uses. */
export function formatGoalScore(score: number | null): string {
  return score === null ? 'DONE' : `${Math.round(score * 100)}%`;
}
