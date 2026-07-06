/**
 * Unit tests for lib/offline-queue.ts.
 *
 * AsyncStorage is replaced with an in-memory mock (same shape as
 * lib/lesson-session-storage.test.ts). supabase-queries executors and
 * Sentry are mocked so no network / native module is touched.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import {
  OFFLINE_QUEUE_MAX_ATTEMPTS,
  OFFLINE_QUEUE_MAX_ITEMS,
  OFFLINE_QUEUE_SCHEMA_VERSION,
  OFFLINE_QUEUE_TTL_MS,
  enqueue,
  flush,
  isNetworkError,
  makeXpKey,
  offlineQueueKey,
  type OfflineQueueInput,
  type ReviewUpsertPayload,
} from './offline-queue';
import {
  fetchReviewItemsByCardIds,
  incrementXpIdempotent,
  upsertLessonCompletion,
  upsertReviewItem,
} from './supabase-queries';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      getItem: jest.fn(async (key: string) => (key in store ? store[key] : null)),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
      clear: jest.fn(async () => {
        store = {};
      }),
    },
  };
});

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
}));

jest.mock('./supabase-queries', () => ({
  fetchReviewItemsByCardIds: jest.fn(),
  incrementXpIdempotent: jest.fn(),
  upsertLessonCompletion: jest.fn(),
  upsertReviewItem: jest.fn(),
}));

const mockFetchByCardIds = fetchReviewItemsByCardIds as jest.Mock;
const mockIncrementXp = incrementXpIdempotent as jest.Mock;
const mockUpsertCompletion = upsertLessonCompletion as jest.Mock;
const mockUpsertReview = upsertReviewItem as jest.Mock;

const USER = 'user-1';
const KEY = offlineQueueKey(USER);

function reviewPayload(overrides: Partial<ReviewUpsertPayload> = {}): ReviewUpsertPayload {
  return {
    userId: USER,
    cardId: 'card-1',
    easeFactor: 2.5,
    interval: 1,
    repetitions: 1,
    nextDue: '2026-07-05T00:00:00.000Z',
    lastReviewedAt: '2026-07-04T12:00:00.000Z',
    status: 'review',
    ...overrides,
  };
}

function reviewInput(overrides: Partial<ReviewUpsertPayload> = {}): OfflineQueueInput {
  return { type: 'review-upsert', payload: reviewPayload(overrides) };
}

function completionInput(): OfflineQueueInput {
  return {
    type: 'lesson-completion',
    payload: { lessonId: 'lesson-1', courseId: 'course-1', score: 0.9, xpEarned: 45, timeSpentMs: 0 },
  };
}

function xpInput(key = 'xp:test:abcdef12'): OfflineQueueInput {
  return { type: 'xp-award', payload: { amount: 20 }, key };
}

function networkError(): TypeError {
  return new TypeError('Network request failed');
}

async function storedItems(): Promise<any[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === null ? [] : JSON.parse(raw).items;
}

let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  // Default executor behavior: everything succeeds, no server review row.
  mockFetchByCardIds.mockResolvedValue([]);
  mockIncrementXp.mockResolvedValue(undefined);
  mockUpsertCompletion.mockResolvedValue({});
  mockUpsertReview.mockResolvedValue({});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('isNetworkError', () => {
  it('classifies fetch TypeErrors as network errors', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new TypeError('Load failed'))).toBe(true);
    expect(isNetworkError(new Error('fetch failed'))).toBe(true);
  });

  it('classifies AbortError / TimeoutError as network errors', () => {
    expect(isNetworkError({ name: 'AbortError', message: 'Aborted' })).toBe(true);
    expect(isNetworkError({ name: 'TimeoutError', message: '' })).toBe(true);
  });

  it('classifies PostgrestError-style objects wrapping fetch failures', () => {
    // postgrest-js stringifies the underlying fetch error into .message
    expect(isNetworkError({ message: 'TypeError: Network request failed', code: '' })).toBe(true);
    expect(isNetworkError({ message: 'TypeError: Failed to fetch', code: '' })).toBe(true);
  });

  it('does NOT classify validation / 4xx / constraint errors', () => {
    expect(isNetworkError({ message: 'invalid XP amount (1-500)', code: '22023' })).toBe(false);
    expect(isNetworkError(new Error('duplicate key value violates unique constraint'))).toBe(false);
    expect(isNetworkError({ message: 'JWT expired', code: 'PGRST301' })).toBe(false);
  });

  it('does NOT classify bare TypeErrors from programming bugs', () => {
    expect(isNetworkError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
  });

  it('handles non-object inputs', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError('Network request failed')).toBe(false);
  });
});

describe('makeXpKey', () => {
  it('produces unique keys within server length bounds (8-128)', () => {
    const a = makeXpKey('lesson-1');
    const b = makeXpKey('lesson-1');
    expect(a).not.toBe(b);
    expect(a.startsWith('xp:lesson-1:')).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a.length).toBeLessThanOrEqual(128);
  });
});

describe('enqueue + flush FIFO', () => {
  it('replays items sequentially in enqueue order and empties the queue', async () => {
    const order: string[] = [];
    mockUpsertReview.mockImplementation(async () => order.push('review'));
    mockUpsertCompletion.mockImplementation(async () => order.push('completion'));
    mockIncrementXp.mockImplementation(async () => order.push('xp'));

    await enqueue(USER, reviewInput());
    await enqueue(USER, completionInput());
    await enqueue(USER, xpInput('xp:lesson-1:abc12345'));

    await flush(USER);

    expect(order).toEqual(['review', 'completion', 'xp']);
    expect(mockUpsertReview).toHaveBeenCalledWith(reviewPayload());
    expect(mockUpsertCompletion).toHaveBeenCalledWith(USER, 'lesson-1', 'course-1', 0.9, 45, 0);
    expect(mockIncrementXp).toHaveBeenCalledWith(20, 'xp:lesson-1:abc12345');
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('flush is a no-op for an empty queue', async () => {
    await flush(USER);
    expect(mockUpsertReview).not.toHaveBeenCalled();
    expect(mockUpsertCompletion).not.toHaveBeenCalled();
    expect(mockIncrementXp).not.toHaveBeenCalled();
  });

  it('does not leak items across users', async () => {
    await enqueue(USER, xpInput());
    await flush('user-2');
    expect(mockIncrementXp).not.toHaveBeenCalled();
    expect(await storedItems()).toHaveLength(1);
  });
});

describe('single-flight', () => {
  it('a concurrent flush call no-ops while one is running', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockIncrementXp.mockImplementation(() => gate);

    await enqueue(USER, xpInput());

    const first = flush(USER);
    // Let the first flush reach its executor (now pending on the gate),
    // then trigger a concurrent flush — it must no-op.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flush(USER);

    // Release BEFORE asserting so a failed expect can't leave the user
    // marked in-flight (which would poison every later flush test).
    release();
    await first;

    expect(mockIncrementXp).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});

describe('failure handling', () => {
  it('a failing item stops the flush, increments attempts, and preserves the xp key', async () => {
    mockIncrementXp.mockRejectedValue(networkError());
    await enqueue(USER, xpInput('xp:lesson-9:zzzz9999'));
    await enqueue(USER, completionInput());

    await flush(USER);

    // Second item never attempted; first item's attempts persisted.
    expect(mockUpsertCompletion).not.toHaveBeenCalled();
    const items = await storedItems();
    expect(items).toHaveLength(2);
    expect(items[0].attempts).toBe(1);
    expect(items[0].key).toBe('xp:lesson-9:zzzz9999'); // retries reuse the same key
    expect(items[1].attempts).toBe(0);
  });

  it('dead-letters an item after OFFLINE_QUEUE_MAX_ATTEMPTS failures and continues', async () => {
    mockIncrementXp.mockRejectedValue(networkError());
    await enqueue(USER, xpInput());
    await enqueue(USER, completionInput());

    for (let i = 0; i < OFFLINE_QUEUE_MAX_ATTEMPTS; i++) {
      await flush(USER);
    }

    expect(mockIncrementXp).toHaveBeenCalledTimes(OFFLINE_QUEUE_MAX_ATTEMPTS);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('dead-letter'),
      'error',
    );
    // The dead-lettered item is gone and the flush moved on to the next one.
    expect(mockUpsertCompletion).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});

describe('TTL', () => {
  it('drops items older than 7 days on load and keeps fresh ones', async () => {
    const now = Date.now();
    const envelope = {
      version: OFFLINE_QUEUE_SCHEMA_VERSION,
      items: [
        {
          id: 'old',
          type: 'xp-award',
          payload: { amount: 10 },
          key: 'xp:old:12345678',
          createdAt: now - OFFLINE_QUEUE_TTL_MS - 60_000,
          attempts: 0,
        },
        {
          id: 'fresh',
          type: 'xp-award',
          payload: { amount: 20 },
          key: 'xp:fresh:12345678',
          createdAt: now - 60_000,
          attempts: 0,
        },
      ],
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(envelope));

    await flush(USER);

    expect(mockIncrementXp).toHaveBeenCalledTimes(1);
    expect(mockIncrementXp).toHaveBeenCalledWith(20, 'xp:fresh:12345678');
    expect(errorSpy).toHaveBeenCalled();
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'offline-queue', level: 'error' }),
    );
  });
});

describe('staleness guard (review-upsert)', () => {
  it('skips (and removes) a replay when the server row is fresher', async () => {
    mockFetchByCardIds.mockResolvedValue([
      { cardId: 'card-1', lastReviewedAt: '2026-07-04T18:00:00.000Z' },
    ]);
    await enqueue(USER, reviewInput({ lastReviewedAt: '2026-07-04T12:00:00.000Z' }));

    await flush(USER);

    expect(mockUpsertReview).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(KEY)).toBeNull(); // removed, not retried
  });

  it('replays when the queued payload is fresher than the server row', async () => {
    mockFetchByCardIds.mockResolvedValue([
      { cardId: 'card-1', lastReviewedAt: '2026-07-04T06:00:00.000Z' },
    ]);
    await enqueue(USER, reviewInput({ lastReviewedAt: '2026-07-04T12:00:00.000Z' }));

    await flush(USER);

    expect(mockUpsertReview).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('replays when no server row exists', async () => {
    mockFetchByCardIds.mockResolvedValue([]);
    await enqueue(USER, reviewInput());

    await flush(USER);

    expect(mockUpsertReview).toHaveBeenCalledTimes(1);
  });
});

describe('capacity cap', () => {
  it('drops the oldest item (with a logged warning) beyond the cap', async () => {
    for (let i = 0; i < OFFLINE_QUEUE_MAX_ITEMS + 1; i++) {
      await enqueue(USER, xpInput(`xp:cap:${String(i).padStart(8, '0')}`));
    }
    const items = await storedItems();
    expect(items).toHaveLength(OFFLINE_QUEUE_MAX_ITEMS);
    expect(items[0].key).toBe('xp:cap:00000001'); // oldest (index 0) was dropped
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('queue full'),
      'xp-award',
      expect.any(String),
    );
  });
});

describe('invalid stored payloads', () => {
  it('discards corrupt JSON', async () => {
    await AsyncStorage.setItem(KEY, 'not-json{');
    await flush(USER);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(mockIncrementXp).not.toHaveBeenCalled();
  });

  it('discards a queue from a different schema version', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ version: OFFLINE_QUEUE_SCHEMA_VERSION + 1, items: [] }),
    );
    await flush(USER);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('drops structurally invalid items but keeps valid ones', async () => {
    const envelope = {
      version: OFFLINE_QUEUE_SCHEMA_VERSION,
      items: [
        { id: 'bad', type: 'xp-award' }, // no payload/key/createdAt/attempts
        {
          id: 'good',
          type: 'lesson-completion',
          payload: { lessonId: 'l', courseId: 'c', score: 1, xpEarned: 10, timeSpentMs: 0 },
          createdAt: Date.now(),
          attempts: 0,
        },
      ],
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(envelope));
    await flush(USER);
    expect(mockUpsertCompletion).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});
