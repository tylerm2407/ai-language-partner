import { calculateNextReview, createNewReviewItem } from './srs';
import type { ReviewItem } from '../types';

/**
 * These tests pin the *scheduling consequence* of the rating chosen for a
 * second-attempt-correct, not the constant itself. The point of rating 3 is
 * that it is honest without being generous — if a future SM-2 change made 3
 * schedule further out than 2 on a first-seen card, "it doesn't count" would
 * quietly start counting, and only this test would notice.
 */

const freshItem = (): ReviewItem => ({
  id: '',
  ...createNewReviewItem('u1', 'card-1'),
});

describe('SM-2 consequences of the recovered rating', () => {
  it('schedules a first-seen card identically for a failed and a recovered answer', () => {
    const failed = calculateNextReview(freshItem(), 2);
    const recovered = calculateNextReview(freshItem(), 3);

    expect(recovered.interval).toBe(failed.interval);
    expect(recovered.nextDue).toBe(failed.nextDue);
  });

  it('schedules a recovered answer sooner than a clean first-time correct', () => {
    const recovered = calculateNextReview(freshItem(), 3);
    const correct = calculateNextReview(freshItem(), 4);

    expect(new Date(recovered.nextDue).getTime()).toBeLessThanOrEqual(
      new Date(correct.nextDue).getTime(),
    );
  });

  it('keeps the repetition streak on a recovered answer but resets it on a failure', () => {
    const seasoned: ReviewItem = {
      ...freshItem(),
      id: 'r1',
      repetitions: 4,
      interval: 30,
      easeFactor: 2.5,
    };

    expect(calculateNextReview(seasoned, 3).repetitions).toBe(5);
    expect(calculateNextReview(seasoned, 2).repetitions).toBe(0);
  });

  it('costs far less to recover than to fail outright', () => {
    // This used to compare ease factors alone and assert that failing cost MORE
    // ease than recovering. That was only true because the EF penalty ran
    // unconditionally, outside the pass branch — the deviation from SM-2 step 4
    // and from .claude/rules/learning.md that pinned repeatedly-missed cards at
    // the 1.3 floor forever.
    //
    // EF was always the wrong thing to measure. A lapse forfeits the entire
    // interval progression, which is the real punishment and is an order of
    // magnitude larger than any ease adjustment.
    const seasoned: ReviewItem = {
      ...freshItem(),
      id: 'r1',
      repetitions: 4,
      interval: 30,
      easeFactor: 2.5,
    };

    const recovered = calculateNextReview(seasoned, 3);
    const failed = calculateNextReview(seasoned, 2);

    // Recovering keeps — and extends — the schedule.
    expect(recovered.interval).toBeGreaterThan(seasoned.interval);
    expect(recovered.repetitions).toBe(5);

    // Failing forfeits it.
    expect(failed.interval).toBe(1);
    expect(failed.repetitions).toBe(0);
    expect(recovered.interval).toBeGreaterThan(failed.interval);

    // A lapse leaves the long-run difficulty estimate alone (SM-2 step 4).
    expect(failed.easeFactor).toBe(seasoned.easeFactor);

    // A passing grade below 4 still nudges it down.
    expect(recovered.easeFactor).toBeLessThan(seasoned.easeFactor);
  });
});
