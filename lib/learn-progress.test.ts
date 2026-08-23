import {
  buildUnitProgress,
  findFocusUnitIndex,
  flattenLessonIds,
  isMilestoneLesson,
  toPercent,
  type LessonRowState,
  type UnitWithLessons,
} from './learn-progress';
import type { Lesson, Unit } from '../types';

function makeUnit(id: string, orderIndex: number, lessonCount: number): UnitWithLessons {
  const unit: Unit = {
    id,
    courseId: 'course-1',
    title: `Unit ${orderIndex + 1}`,
    description: '',
    orderIndex,
    totalLessons: lessonCount,
  };
  const lessons: Lesson[] = Array.from({ length: lessonCount }, (_, i) => ({
    id: `${id}-l${i}`,
    unitId: id,
    courseId: 'course-1',
    title: `Lesson ${i + 1}`,
    description: '',
    orderIndex: i,
    estimatedMinutes: 5,
    xpReward: 20,
    exercises: [],
  }));
  return { unit, lessons };
}

/** Stand-in for useLessonProgress: everything before `completedThrough` is done. */
function progressLookups(completedIds: Set<string>, scores: Record<string, number> = {}) {
  const getLessonState = (lessonId: string, orderedIds: string[]): LessonRowState => {
    if (completedIds.has(lessonId)) return 'completed';
    const idx = orderedIds.indexOf(lessonId);
    if (idx === 0) return 'active';
    if (idx > 0 && completedIds.has(orderedIds[idx - 1])) return 'active';
    return 'locked';
  };
  const getScore = (lessonId: string): number | null => scores[lessonId] ?? null;
  return { getLessonState, getScore };
}

describe('flattenLessonIds', () => {
  it('spans units in course order', () => {
    const units = [makeUnit('u1', 0, 2), makeUnit('u2', 1, 2)];
    expect(flattenLessonIds(units)).toEqual(['u1-l0', 'u1-l1', 'u2-l0', 'u2-l1']);
  });

  it('returns an empty list for an empty course', () => {
    expect(flattenLessonIds([])).toEqual([]);
  });
});

describe('isMilestoneLesson', () => {
  it('marks the last lesson of a unit', () => {
    expect(isMilestoneLesson(5, 6)).toBe(true);
    expect(isMilestoneLesson(4, 6)).toBe(false);
  });

  it('does not mark a single-lesson unit — there is nothing to review', () => {
    expect(isMilestoneLesson(0, 1)).toBe(false);
  });
});

describe('buildUnitProgress', () => {
  it('rolls up completion counts per unit', () => {
    const units = [makeUnit('u1', 0, 6), makeUnit('u2', 1, 6)];
    const { getLessonState, getScore } = progressLookups(
      new Set(['u1-l0', 'u1-l1', 'u1-l2']),
    );

    const [first, second] = buildUnitProgress(units, getLessonState, getScore);

    expect(first.completedCount).toBe(3);
    expect(first.totalCount).toBe(6);
    expect(first.progress).toBeCloseTo(0.5);
    expect(second.completedCount).toBe(0);
  });

  it('counts unattempted lessons as zero when averaging mastery', () => {
    const units = [makeUnit('u1', 0, 6)];
    const { getLessonState, getScore } = progressLookups(
      new Set(['u1-l0', 'u1-l1', 'u1-l2']),
      { 'u1-l0': 1, 'u1-l1': 0.75, 'u1-l2': 0.5 },
    );

    const [first] = buildUnitProgress(units, getLessonState, getScore);

    // (1 + 0.75 + 0.5 + 0 + 0 + 0) / 6
    expect(first.mastery).toBeCloseTo(0.375);
    expect(toPercent(first.mastery)).toBe(38);
  });

  it('does not report full mastery off one perfect lesson', () => {
    const units = [makeUnit('u1', 0, 6)];
    const { getLessonState, getScore } = progressLookups(new Set(['u1-l0']), { 'u1-l0': 1 });

    const [first] = buildUnitProgress(units, getLessonState, getScore);

    expect(toPercent(first.mastery)).toBe(17);
  });

  it('unlocks the next unit off the previous unit last lesson', () => {
    const units = [makeUnit('u1', 0, 2), makeUnit('u2', 1, 2)];
    const { getLessonState, getScore } = progressLookups(new Set(['u1-l0', 'u1-l1']));

    const [first, second] = buildUnitProgress(units, getLessonState, getScore);

    expect(first.lessonStates).toEqual(['completed', 'completed']);
    expect(second.lessonStates).toEqual(['active', 'locked']);
    expect(second.hasActiveLesson).toBe(true);
    expect(first.hasActiveLesson).toBe(false);
  });

  it('handles a unit with no lessons without dividing by zero', () => {
    const units = [makeUnit('u1', 0, 0)];
    const { getLessonState, getScore } = progressLookups(new Set());

    const [first] = buildUnitProgress(units, getLessonState, getScore);

    expect(first.progress).toBe(0);
    expect(first.mastery).toBe(0);
  });
});

describe('a brand-new account', () => {
  // The state every learner sees on first open, and the one a screen built
  // from a progress-filled mockup is most likely to get wrong.
  const units = [makeUnit('u1', 0, 6), makeUnit('u2', 1, 6)];
  const { getLessonState, getScore } = progressLookups(new Set());
  const progress = buildUnitProgress(units, getLessonState, getScore);

  it('opens on unit 1 with an empty progress bar', () => {
    expect(findFocusUnitIndex(progress)).toBe(0);
    expect(progress[0].completedCount).toBe(0);
    expect(progress[0].progress).toBe(0);
    expect(toPercent(progress[0].mastery)).toBe(0);
  });

  it('unlocks exactly the first lesson and locks the rest', () => {
    expect(progress[0].lessonStates).toEqual([
      'active',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
    expect(progress[0].lessonScores).toEqual([null, null, null, null, null, null]);
  });

  it('leaves later units untouched rather than partly unlocked', () => {
    expect(progress[1].lessonStates.every((s) => s === 'locked')).toBe(true);
    expect(progress[1].hasActiveLesson).toBe(false);
  });
});

describe('findFocusUnitIndex', () => {
  const units = [makeUnit('u1', 0, 2), makeUnit('u2', 1, 2), makeUnit('u3', 2, 2)];

  it('opens on the unit holding the next unlocked lesson', () => {
    const { getLessonState, getScore } = progressLookups(new Set(['u1-l0', 'u1-l1', 'u2-l0']));
    expect(findFocusUnitIndex(buildUnitProgress(units, getLessonState, getScore))).toBe(1);
  });

  it('opens on the first unit for a brand-new learner', () => {
    const { getLessonState, getScore } = progressLookups(new Set());
    expect(findFocusUnitIndex(buildUnitProgress(units, getLessonState, getScore))).toBe(0);
  });

  it('opens on the last unit once the course is finished', () => {
    const allIds = new Set(flattenLessonIds(units));
    const { getLessonState, getScore } = progressLookups(allIds);
    expect(findFocusUnitIndex(buildUnitProgress(units, getLessonState, getScore))).toBe(2);
  });

  it('returns 0 for an empty course', () => {
    expect(findFocusUnitIndex([])).toBe(0);
  });
});

describe('toPercent', () => {
  it('rounds to whole percent and clamps out-of-range input', () => {
    expect(toPercent(0.375)).toBe(38);
    expect(toPercent(1.4)).toBe(100);
    expect(toPercent(-0.2)).toBe(0);
    expect(toPercent(Number.NaN)).toBe(0);
  });
});
