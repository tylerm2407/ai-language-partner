/**
 * Unit-level progress derivation for the Learn screen's Vocab tab.
 *
 * The screen shows a horizontal unit carousel over a list of that unit's
 * lessons, so it needs two things the raw `{ unit, lessons }[]` shape doesn't
 * carry: per-unit rollups (how far in, how well) and which unit the learner is
 * actually standing in.
 *
 * Everything here is pure — the completion data arrives as the two lookups
 * `useLessonProgress` already exposes, so this module is testable without a
 * Supabase session.
 */

import type { Lesson, Unit } from '../types';

/** Mirrors `LessonState` from hooks/useLessonProgress. */
export type LessonRowState = 'completed' | 'active' | 'locked';

export interface UnitWithLessons {
  unit: Unit;
  lessons: Lesson[];
}

export interface UnitProgress extends UnitWithLessons {
  /** 0-based position in the course, i.e. the carousel index. */
  index: number;
  /** Per-lesson state, index-aligned with `lessons`. */
  lessonStates: LessonRowState[];
  /** Per-lesson score 0-1, `null` where the lesson has no completion. */
  lessonScores: (number | null)[];
  completedCount: number;
  totalCount: number;
  /** 0-1 — completed lessons over total. Drives the card's progress bar. */
  progress: number;
  /**
   * 0-1 — mean score across EVERY lesson in the unit, with an unattempted
   * lesson counting as zero.
   *
   * Deliberately not "mean score over completed lessons": that reads 100%
   * after a single perfect lesson out of six, which is the one number a
   * learner would take at face value. Unattempted-as-zero makes the figure
   * monotonic — it can only rise by doing more work or doing it better.
   */
  mastery: number;
  /** True when this unit holds the learner's next unlocked lesson. */
  hasActiveLesson: boolean;
}

/**
 * Course-order lesson ids. `getLessonState` resolves a lesson against the
 * whole ordered course (a unit's first lesson unlocks off the previous unit's
 * last), so the flat list has to span units, not just the selected one.
 */
export function flattenLessonIds(units: UnitWithLessons[]): string[] {
  const ids: string[] = [];
  for (const { lessons } of units) {
    for (const lesson of lessons) ids.push(lesson.id);
  }
  return ids;
}

/**
 * A unit's last lesson is its "Review & Test" — the curriculum authors one per
 * unit and always places it last. The row renders as a milestone.
 */
export function isMilestoneLesson(lessonIndex: number, lessonCount: number): boolean {
  return lessonCount > 1 && lessonIndex === lessonCount - 1;
}

export function buildUnitProgress(
  units: UnitWithLessons[],
  getLessonState: (lessonId: string, orderedIds: string[]) => LessonRowState,
  getScore: (lessonId: string) => number | null,
): UnitProgress[] {
  const orderedIds = flattenLessonIds(units);

  return units.map(({ unit, lessons }, index) => {
    const lessonStates = lessons.map((l) => getLessonState(l.id, orderedIds));
    const lessonScores = lessons.map((l) => getScore(l.id));
    const completedCount = lessonStates.filter((s) => s === 'completed').length;
    const totalCount = lessons.length;

    // An unattempted lesson contributes 0, so the denominator is always the
    // full unit — see the `mastery` doc comment.
    const scoreSum = lessonScores.reduce<number>((sum, score) => sum + (score ?? 0), 0);

    return {
      unit,
      lessons,
      index,
      lessonStates,
      lessonScores,
      completedCount,
      totalCount,
      progress: totalCount === 0 ? 0 : completedCount / totalCount,
      mastery: totalCount === 0 ? 0 : clamp01(scoreSum / totalCount),
      hasActiveLesson: lessonStates.includes('active'),
    };
  });
}

/**
 * Which unit the carousel should open on: the one holding the next unlocked
 * lesson. Falls back to the last unit when the course is finished (nothing is
 * 'active' any more) and to the first when there is no progress data at all.
 */
export function findFocusUnitIndex(unitProgress: UnitProgress[]): number {
  if (unitProgress.length === 0) return 0;

  const active = unitProgress.findIndex((u) => u.hasActiveLesson);
  if (active !== -1) return active;

  const everythingDone = unitProgress.every(
    (u) => u.totalCount > 0 && u.completedCount === u.totalCount,
  );
  return everythingDone ? unitProgress.length - 1 : 0;
}

/** Whole-percent form of a 0-1 ratio, for the mono `38% MASTERED` label. */
export function toPercent(ratio: number): number {
  return Math.round(clamp01(ratio) * 100);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
