/**
 * SM-2, the algorithm the whole product rests on.
 *
 * There was no test file for `lib/srs.ts` at all, which is how two deviations
 * from `.claude/rules/learning.md` survived: the ease-factor penalty ran on
 * lapses (spec says keep EF), and due dates carried a time-of-day.
 *
 * Every expectation below is traceable to the rules file or to SuperMemo 2
 * itself, so a future change that contradicts the spec fails here rather than
 * quietly reshaping every learner's review schedule.
 */
import { calculateNextReview, createNewReviewItem, isDue, sortReviewQueue } from './srs';
import { SRS_DEFAULTS } from '../config/app';
import type { ReviewItem } from '../types';

function item(over: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'r1',
    userId: 'u1',
    cardId: 'c1',
    easeFactor: SRS_DEFAULTS.initialEaseFactor,
    interval: 0,
    repetitions: 0,
    nextDue: new Date().toISOString(),
    lastReviewedAt: null,
    status: 'new',
    ...over,
  } as ReviewItem;
}

describe('interval progression', () => {
  it('walks 1 -> 6 -> interval * EF on passing grades', () => {
    // .claude/rules/learning.md: "calculate new interval (1 -> 6 -> prev * EF)"
    const first = calculateNextReview(item(), 4);
    expect(first.repetitions).toBe(1);
    expect(first.interval).toBe(1);

    const second = calculateNextReview(item({ repetitions: 1, interval: 1 }), 4);
    expect(second.repetitions).toBe(2);
    expect(second.interval).toBe(6);

    const third = calculateNextReview(item({ repetitions: 2, interval: 6, easeFactor: 2.5 }), 4);
    expect(third.repetitions).toBe(3);
    expect(third.interval).toBe(Math.round(6 * 2.5));
  });

  it('resets to a one-day interval on a lapse', () => {
    const lapsed = calculateNextReview(item({ repetitions: 7, interval: 200 }), 2);
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.interval).toBe(1);
  });
});

describe('ease factor', () => {
  it('is left untouched by a lapse', () => {
    // SM-2 step 4, and the rules file: "If rating < 3: ... keep EF."
    for (const rating of [0, 1, 2] as const) {
      const before = 2.5;
      expect(calculateNextReview(item({ easeFactor: before, repetitions: 3, interval: 20 }), rating).easeFactor)
        .toBe(before);
    }
  });

  it('does not drift on a clean answer, and eases down on a laboured one', () => {
    const base = item({ repetitions: 3, interval: 20, easeFactor: 2.5 });
    // rating 4 -> 0.1 - 1*(0.08 + 0.02) = 0
    expect(calculateNextReview(base, 4).easeFactor).toBeCloseTo(2.5, 10);
    // rating 5 -> +0.1
    expect(calculateNextReview(base, 5).easeFactor).toBeCloseTo(2.6, 10);
    // rating 3 -> -0.14
    expect(calculateNextReview(base, 3).easeFactor).toBeCloseTo(2.36, 10);
  });

  it('never falls below the documented floor', () => {
    const brittle = item({ repetitions: 3, interval: 20, easeFactor: 1.3 });
    expect(calculateNextReview(brittle, 3).easeFactor).toBe(SRS_DEFAULTS.minimumEaseFactor);
  });

  it('does not pin a repeatedly-missed card at the floor', () => {
    // THE regression. Every wrong in-lesson answer is rated 2 (lesson-srs.ts),
    // and the EF penalty used to run on lapses too — 0.32 each, so four misses
    // drove any card to 1.3 permanently, since a perfect answer returns only
    // 0.1. Its intervals then grew ~3x slower forever.
    let card = item({ repetitions: 4, interval: 30, easeFactor: 2.5 });
    for (let i = 0; i < 6; i++) {
      const next = calculateNextReview(card, 2);
      card = item({ ...next, id: 'r1', userId: 'u1', cardId: 'c1', lastReviewedAt: null });
    }
    expect(card.easeFactor).toBe(2.5);
  });
});

describe('due dates', () => {
  it('falls on the start of a local day, not the review time', () => {
    // `setDate` alone preserved the clock, so a card reviewed at 21:30 was not
    // due until 21:30 the next day — permanently ~10h out of reach of a morning
    // learner, and invisible to the warm-up queue.
    const due = new Date(calculateNextReview(item(), 4).nextDue);
    expect(due.getHours()).toBe(0);
    expect(due.getMinutes()).toBe(0);
    expect(due.getSeconds()).toBe(0);
    expect(due.getMilliseconds()).toBe(0);
  });

  it('lands `interval` days ahead', () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const due = new Date(calculateNextReview(item({ repetitions: 1, interval: 1 }), 4).nextDue);
    const days = Math.round((due.getTime() - start.getTime()) / 86_400_000);
    expect(days).toBe(6);
  });
});

describe('status', () => {
  it('reports learning after a lapse, graduated past three weeks', () => {
    expect(calculateNextReview(item({ repetitions: 5, interval: 90 }), 1).status).toBe('learning');
    expect(calculateNextReview(item({ repetitions: 2, interval: 6, easeFactor: 2.5 }), 4).status)
      .toBe('review');
    expect(calculateNextReview(item({ repetitions: 4, interval: 20, easeFactor: 2.5 }), 4).status)
      .toBe('graduated');
  });
});

describe('queue helpers', () => {
  it('treats a past due date as due and a future one as not', () => {
    expect(isDue(item({ nextDue: new Date(Date.now() - 1000).toISOString() }))).toBe(true);
    expect(isDue(item({ nextDue: new Date(Date.now() + 86_400_000).toISOString() }))).toBe(false);
  });

  it('sorts most-overdue first, then hardest first', () => {
    const now = Date.now();
    const sorted = sortReviewQueue([
      item({ id: 'recent', nextDue: new Date(now - 1000).toISOString(), easeFactor: 2.5 }),
      item({ id: 'ancient', nextDue: new Date(now - 90_000_000).toISOString(), easeFactor: 2.5 }),
    ]);
    expect(sorted[0].id).toBe('ancient');
  });

  it('starts a new card at the documented defaults', () => {
    const fresh = createNewReviewItem('u1', 'c1');
    expect(fresh.easeFactor).toBe(SRS_DEFAULTS.initialEaseFactor);
    expect(fresh.repetitions).toBe(0);
    expect(fresh.status).toBe('new');
  });
});
