import { calculateNextReview, createNewReviewItem } from './srs';
import {
  RATING_BY_OUTCOME,
  recordLessonSrsResult,
  recordWarmupSrsResult,
  type LessonSrsOutcome,
} from './lesson-srs';
import {
  insertReviewLogIdempotent,
  tryConsumeNewCardSlot,
  upsertReviewItem,
} from './supabase-queries';
import { enqueue } from './offline-queue';
import type { ReviewItem } from '../types';

jest.mock('./supabase-queries', () => ({
  insertReviewLogIdempotent: jest.fn(),
  tryConsumeNewCardSlot: jest.fn(),
  upsertReviewItem: jest.fn(),
}));

jest.mock('./offline-queue', () => {
  let n = 0;
  return {
    enqueue: jest.fn(async () => {}),
    // Real-enough heuristic: the module's branch on it is what is under test.
    isNetworkError: (err: unknown) =>
      /network request failed|failed to fetch/i.test(err instanceof Error ? err.message : String(err)),
    newClientLogId: jest.fn(() => `rl:test-${++n}`),
  };
});

const mockUpsert = upsertReviewItem as jest.Mock;
const mockLog = insertReviewLogIdempotent as jest.Mock;
const mockSlot = tryConsumeNewCardSlot as jest.Mock;
const mockEnqueue = enqueue as jest.Mock;

const USER = 'u1';
const CARD = 'card-1';
const EVIDENCE = { userAnswer: 'la manzana', responseTimeMs: 2500 };

const freshItem = (): ReviewItem => ({
  id: '',
  ...createNewReviewItem(USER, CARD),
});

const knownItem = (): ReviewItem => ({
  ...freshItem(),
  id: 'ri-1',
  repetitions: 2,
  interval: 6,
  easeFactor: 2.5,
  status: 'review',
});

function networkError(): TypeError {
  return new TypeError('Network request failed');
}

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockSlot.mockResolvedValue(true);
  // The server hands back the row with its id — what the log must point at.
  mockUpsert.mockImplementation(async (p: Record<string, unknown>) => ({ ...p, id: p.id ?? 'ri-new' }));
  mockLog.mockResolvedValue(undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
});

/**
 * These tests pin the *scheduling consequence* of the rating chosen for a
 * second-attempt-correct, not the constant itself. The point of rating 3 is
 * that it is honest without being generous — if a future SM-2 change made 3
 * schedule further out than 2 on a first-seen card, "it doesn't count" would
 * quietly start counting, and only this test would notice.
 */
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

describe('rating map', () => {
  it('rates correct 4, recovered 3, wrong 2', () => {
    expect(RATING_BY_OUTCOME).toEqual({ correct: 4, recovered: 3, wrong: 2 });
  });
});

describe('recordLessonSrsResult — the review_logs row', () => {
  // The bug this pins: lessons upserted review_items but never wrote a log,
  // and the proficiency report's confidence gate counts logs. A lessons-only
  // learner could never be measured.
  it.each<[LessonSrsOutcome, number, boolean]>([
    ['correct', 4, true],
    ['recovered', 3, false],
    ['wrong', 2, false],
  ])('writes one log per %s answer with rating %i and wasCorrect %s', async (outcome, rating, wasCorrect) => {
    const existing = new Map([[CARD, knownItem()]]);
    const result = await recordLessonSrsResult(USER, CARD, outcome, new Set(), existing, EVIDENCE);

    expect(result).toEqual({ status: 'written' });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        cardId: CARD,
        reviewItemId: 'ri-1',
        rating,
        wasCorrect,
        responseTimeMs: 2500,
        userAnswer: 'la manzana',
        clientLogId: expect.stringMatching(/^rl:/),
      }),
    );
    expect(mockSlot).not.toHaveBeenCalled();
  });

  it('points a first-seen card\'s log at the row the upsert just created', async () => {
    const introduced = new Set<string>();
    await recordLessonSrsResult(USER, CARD, 'correct', introduced, new Map(), EVIDENCE);

    expect(mockSlot).toHaveBeenCalledWith(CARD);
    expect(introduced.has(CARD)).toBe(true);
    expect(mockLog).toHaveBeenCalledWith(expect.objectContaining({ reviewItemId: 'ri-new' }));
  });

  it('writes nothing — no upsert, no log — when the new-card cap is reached', async () => {
    mockSlot.mockResolvedValue(false);
    const result = await recordLessonSrsResult(USER, CARD, 'correct', new Set(), new Map(), EVIDENCE);

    expect(result).toEqual({ status: 'skipped', reason: 'cap-reached' });
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockLog).not.toHaveBeenCalled();
  });

  it('caps the logged answer so a free-production paragraph stays a log row', async () => {
    const existing = new Map([[CARD, knownItem()]]);
    await recordLessonSrsResult(USER, CARD, 'correct', new Set(), existing, {
      userAnswer: 'x'.repeat(2000),
      responseTimeMs: 1,
    });
    expect((mockLog.mock.calls[0][0] as { userAnswer: string }).userAnswer).toHaveLength(500);
  });
});

describe('recordLessonSrsResult — offline', () => {
  it('queues both the upsert and the log for a known card', async () => {
    mockUpsert.mockRejectedValueOnce(networkError());
    mockLog.mockRejectedValueOnce(networkError());
    const existing = new Map([[CARD, knownItem()]]);

    const result = await recordLessonSrsResult(USER, CARD, 'wrong', new Set(), existing, EVIDENCE);

    expect(result).toEqual({ status: 'written' });
    const types = mockEnqueue.mock.calls.map((c) => c[1].type);
    expect(types).toEqual(['review-upsert', 'review-log']);
    // The known row id is already in hand, so the queued log can carry it.
    expect(mockEnqueue.mock.calls[1][1].payload.reviewItemId).toBe('ri-1');
    // In-session state chains from the locally computed result.
    expect(existing.get(CARD)?.repetitions).toBe(0);
  });

  it('queues a first-seen card\'s log with an empty row id, behind its upsert', async () => {
    // review_logs.review_item_id is NOT NULL and the row does not exist yet;
    // the replay resolves it (lib/offline-queue.ts, case 'review-log').
    mockUpsert.mockRejectedValueOnce(networkError());

    await recordLessonSrsResult(USER, CARD, 'correct', new Set(), new Map(), EVIDENCE);

    expect(mockLog).not.toHaveBeenCalled();
    const types = mockEnqueue.mock.calls.map((c) => c[1].type);
    expect(types).toEqual(['review-upsert', 'review-log']);
    expect(mockEnqueue.mock.calls[1][1].payload.reviewItemId).toBe('');
    expect(typeof mockEnqueue.mock.calls[1][1].payload.clientLogId).toBe('string');
  });

  it('skips a first-seen card when the cap RPC itself is unreachable', async () => {
    mockSlot.mockRejectedValueOnce(networkError());
    const result = await recordLessonSrsResult(USER, CARD, 'correct', new Set(), new Map(), EVIDENCE);
    expect(result).toEqual({ status: 'skipped', reason: 'offline' });
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('rethrows a non-network upsert failure instead of queueing it', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('permission denied'));
    const existing = new Map([[CARD, knownItem()]]);
    await expect(
      recordLessonSrsResult(USER, CARD, 'correct', new Set(), existing, EVIDENCE),
    ).rejects.toThrow('permission denied');
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockLog).not.toHaveBeenCalled();
  });

  it('rethrows a non-network log failure after the upsert landed', async () => {
    mockLog.mockRejectedValueOnce(new Error('violates check constraint'));
    const existing = new Map([[CARD, knownItem()]]);
    await expect(
      recordLessonSrsResult(USER, CARD, 'correct', new Set(), existing, EVIDENCE),
    ).rejects.toThrow('check constraint');
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

describe('recordWarmupSrsResult', () => {
  it('uses the same rating map and writes the same two rows as a lesson answer', async () => {
    const item = knownItem();
    const existing = new Map<string, ReviewItem>();

    await recordWarmupSrsResult(item, false, existing, EVIDENCE);

    expect(mockSlot).not.toHaveBeenCalled(); // a due card is never new
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'ri-1', cardId: CARD, repetitions: 0 }));
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({ reviewItemId: 'ri-1', rating: RATING_BY_OUTCOME.wrong, wasCorrect: false }),
    );
    // The prefetched map is kept current so a main-lesson exercise on the
    // same card chains from the warm-up's advancement.
    expect(existing.get(CARD)?.id).toBe('ri-1');
  });

  it('rates a warm-up pass exactly as a first-attempt lesson correct', async () => {
    await recordWarmupSrsResult(knownItem(), true, null, EVIDENCE);
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({ rating: RATING_BY_OUTCOME.correct, wasCorrect: true }),
    );
  });
});
