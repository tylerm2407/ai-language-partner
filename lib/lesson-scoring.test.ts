import { summarizeLesson } from './lesson-scoring';
import type { AttemptStatusMap } from './lesson-attempts';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `ex${i}`);

const statusMap = (list: AttemptStatusMap[string][]): AttemptStatusMap =>
  Object.fromEntries(list.map((s, i) => [`ex${i}`, s]));

describe('summarizeLesson', () => {
  it('counts a clean run as perfect and pays full XP', () => {
    const s = summarizeLesson(statusMap(Array(4).fill('correct')), ids(4), 20);
    expect(s).toMatchObject({ correctCount: 4, scoredCount: 4, skippedCount: 0, accuracy: 1, xpEarned: 20, perfect: true });
  });

  it('does not count a recovered answer as correct', () => {
    const s = summarizeLesson(statusMap(['correct', 'recovered', 'correct', 'wrong']), ids(4), 20);
    expect(s.correctCount).toBe(2);
    expect(s.accuracy).toBe(0.5);
    expect(s.perfect).toBe(false);
  });

  it('leaves skipped questions out of the denominator', () => {
    // 3 answered, all right, 1 skipped — accuracy is 100%, not 75%.
    const s = summarizeLesson(statusMap(['correct', 'correct', 'correct', 'skipped']), ids(4), 20);
    expect(s.scoredCount).toBe(3);
    expect(s.accuracy).toBe(1);
  });

  it('is never perfect when something was skipped', () => {
    const s = summarizeLesson(statusMap(['correct', 'correct', 'correct', 'skipped']), ids(4), 20);
    expect(s.perfect).toBe(false);
  });

  it('does not pay full XP for a lesson skipped down to one lucky question', () => {
    // The exploit this guards: 100% accuracy on a single answered question.
    const s = summarizeLesson(
      statusMap(['correct', ...Array(11).fill('skipped')]),
      ids(12),
      120,
    );
    expect(s.accuracy).toBe(1);
    expect(s.xpEarned).toBe(10); // 120 * 1.0 * (1/12)
  });

  it('scales XP by the share of the lesson actually attempted', () => {
    const s = summarizeLesson(
      statusMap([...Array(10).fill('correct'), 'skipped', 'skipped']),
      ids(12),
      120,
    );
    expect(s.xpEarned).toBe(100); // 120 * 1.0 * (10/12)
  });

  it('pays nothing and claims nothing for a fully skipped lesson', () => {
    const s = summarizeLesson(statusMap(Array(4).fill('skipped')), ids(4), 20);
    expect(s).toMatchObject({ scoredCount: 0, accuracy: 0, xpEarned: 0, perfect: false });
  });

  it('handles an empty lesson without dividing by zero', () => {
    const s = summarizeLesson({}, [], 20);
    expect(s).toMatchObject({ totalExercises: 0, accuracy: 0, xpEarned: 0, perfect: false });
  });

  it('treats an unanswered exercise as scored-but-not-correct', () => {
    const s = summarizeLesson(statusMap(['correct', 'unanswered']), ids(2), 20);
    expect(s.scoredCount).toBe(2);
    expect(s.accuracy).toBe(0.5);
  });
});
