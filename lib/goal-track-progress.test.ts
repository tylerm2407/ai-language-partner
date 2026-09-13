import {
  formatGoalScore,
  goalLessonRowState,
  summarizeGoalTrack,
  type GoalTrackLesson,
} from './goal-track-progress';

function lesson(
  id: string,
  opts: { done?: number | null; state?: GoalTrackLesson['generationState'] } = {},
): GoalTrackLesson {
  return {
    id,
    title: `Lesson ${id}`,
    description: `Do ${id}`,
    orderIndex: Number(id),
    generationState: opts.state === undefined ? 'ready' : opts.state,
    completion:
      opts.done === undefined
        ? null
        : { score: opts.done, completedAt: '2026-09-13T10:00:00Z' },
  };
}

describe('summarizeGoalTrack', () => {
  it('counts completions and points at the first unfinished lesson', () => {
    const s = summarizeGoalTrack([lesson('1', { done: 0.9 }), lesson('2'), lesson('3')]);
    expect(s).toEqual({ doneCount: 1, total: 3, progress: 1 / 3, nextLessonId: '2' });
  });

  it('sends a learner who skipped ahead back to the gap', () => {
    // The track was planned so each lesson builds on the last; finishing
    // lesson 3 first does not make lesson 4 the next one.
    const s = summarizeGoalTrack([lesson('1'), lesson('2'), lesson('3', { done: 1 })]);
    expect(s.nextLessonId).toBe('1');
  });

  it('skips over a lesson somebody else is building', () => {
    // A primary target that cannot be tapped is no call to action at all.
    const s = summarizeGoalTrack([lesson('1', { state: 'generating' }), lesson('2', { state: 'pending' })]);
    expect(s.nextLessonId).toBe('2');
  });

  it('has no next lesson once everything is done', () => {
    const s = summarizeGoalTrack([lesson('1', { done: 1 }), lesson('2', { done: 0.5 })]);
    expect(s).toEqual({ doneCount: 2, total: 2, progress: 1, nextLessonId: null });
  });

  it('reports zero progress for an empty track rather than NaN', () => {
    expect(summarizeGoalTrack([])).toEqual({ doneCount: 0, total: 0, progress: 0, nextLessonId: null });
  });
});

describe('goalLessonRowState', () => {
  it('ranks completed above everything, then generating, then next', () => {
    expect(goalLessonRowState(lesson('1', { done: 1, state: 'generating' }), '1')).toBe('completed');
    expect(goalLessonRowState(lesson('1', { state: 'generating' }), '1')).toBe('generating');
    expect(goalLessonRowState(lesson('1'), '1')).toBe('next');
    expect(goalLessonRowState(lesson('1'), '2')).toBe('open');
  });

  it('treats a hand-authored (null state) lesson as openable', () => {
    expect(goalLessonRowState(lesson('1', { state: null }), null)).toBe('open');
  });
});

describe('formatGoalScore', () => {
  it('rounds to a whole percent and falls back to DONE', () => {
    expect(formatGoalScore(0.945)).toBe('95%');
    expect(formatGoalScore(1)).toBe('100%');
    expect(formatGoalScore(null)).toBe('DONE');
  });
});
