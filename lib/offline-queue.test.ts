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
  OFFLINE_QUEUE_MAX_NON_NETWORK_ATTEMPTS,
  OFFLINE_QUEUE_MAX_ITEMS,
  OFFLINE_QUEUE_SCHEMA_VERSION,
  OFFLINE_QUEUE_TTL_MS,
  enqueue,
  flush,
  isNetworkError,
  offlineQueueKey,
  newClientLogId,
  newClientResultId,
  type ExerciseResultPayload,
  type OfflineQueueInput,
  type ReviewLogPayload,
  type ReviewUpsertPayload,
} from './offline-queue';
import {
  fetchReviewItemsByCardIds,
  insertReviewLogIdempotent,
  recordExerciseResult,
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
  insertReviewLogIdempotent: jest.fn(),
  recordExerciseResult: jest.fn(),
  upsertLessonCompletion: jest.fn(),
  upsertReviewItem: jest.fn(),
}));

const mockFetchByCardIds = fetchReviewItemsByCardIds as jest.Mock;
const mockUpsertCompletion = upsertLessonCompletion as jest.Mock;
const mockUpsertReview = upsertReviewItem as jest.Mock;
const mockInsertReviewLog = insertReviewLogIdempotent as jest.Mock;
const mockRecordExerciseResult = recordExerciseResult as jest.Mock;

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
    payload: { lessonId: 'lesson-1', courseId: 'course-1', score: 0.9, timeSpentMs: 0 },
  };
}

/** A third, distinct item type for ordering and capacity tests. */
function resultInput(clientResultId = 'er:test-abcdef12'): OfflineQueueInput {
  return {
    type: 'exercise-result',
    payload: { exerciseId: 'ex-1', correct: true, attempts: 1, responseTimeMs: 1200, clientResultId },
  };
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
  mockUpsertCompletion.mockResolvedValue({});
  mockUpsertReview.mockResolvedValue({});
  mockRecordExerciseResult.mockResolvedValue({});
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

describe('enqueue + flush FIFO', () => {
  it('replays items sequentially in enqueue order and empties the queue', async () => {
    const order: string[] = [];
    mockUpsertReview.mockImplementation(async () => order.push('review'));
    mockUpsertCompletion.mockImplementation(async () => order.push('completion'));
    mockRecordExerciseResult.mockImplementation(async () => order.push('result'));

    await enqueue(USER, reviewInput());
    await enqueue(USER, completionInput());
    await enqueue(USER, resultInput());

    await flush(USER);

    expect(order).toEqual(['review', 'completion', 'result']);
    expect(mockUpsertReview).toHaveBeenCalledWith(reviewPayload());
    expect(mockUpsertCompletion).toHaveBeenCalledWith(USER, 'lesson-1', 'course-1', 0.9, 0);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('flush is a no-op for an empty queue', async () => {
    await flush(USER);
    expect(mockUpsertReview).not.toHaveBeenCalled();
    expect(mockUpsertCompletion).not.toHaveBeenCalled();
  });

  it('does not leak items across users', async () => {
    await enqueue(USER, resultInput());
    await flush('user-2');
    expect(await storedItems()).toHaveLength(1);
  });
});

describe('single-flight', () => {
  it('a concurrent flush call no-ops while one is running', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockUpsertCompletion.mockImplementation(() => gate);

    await enqueue(USER, completionInput());

    const first = flush(USER);
    // Let the first flush reach its executor (now pending on the gate),
    // then trigger a concurrent flush — it must no-op.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flush(USER);

    // Release BEFORE asserting so a failed expect can't leave the user
    // marked in-flight (which would poison every later flush test).
    release();
    await first;

    expect(mockUpsertCompletion).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});

describe('failure handling', () => {
  it('skips a failing item rather than blocking what is behind it', async () => {
    // The flush used to STOP on the first failure. Because completions are
    // queued on 4xx as well as network errors, one permanently-invalid row at
    // the head froze every later review write — and `attempts`
    // increments once per flush TRIGGER, so clearing it took ten
    // mount/reconnect cycles, i.e. days.
    mockUpsertCompletion.mockRejectedValue(networkError());
    await enqueue(USER, completionInput());
    await enqueue(USER, reviewInput());

    await flush(USER);

    // The item behind the failure still ran.
    expect(mockUpsertReview).toHaveBeenCalledTimes(1);

    // The failed completion is retained for a later trigger.
    const items = await storedItems();
    expect(items).toHaveLength(1);
    expect(items[0].attempts).toBe(1);
    expect(items[0].type).toBe('lesson-completion');
  });

  it('dead-letters a non-network failure after two attempts, not ten', async () => {
    // A 4xx does not fix itself. Retrying it to the network budget only delays
    // the point at which the queue behind it drains.
    mockUpsertCompletion.mockRejectedValue(new Error('invalid lesson id'));
    await enqueue(USER, completionInput());

    await flush(USER);
    expect(await storedItems()).toHaveLength(1);

    await flush(USER);

    expect(mockUpsertCompletion).toHaveBeenCalledTimes(OFFLINE_QUEUE_MAX_NON_NETWORK_ATTEMPTS);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('dead-letter'),
      'error',
    );
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('dead-letters an item after OFFLINE_QUEUE_MAX_ATTEMPTS failures and continues', async () => {
    mockUpsertCompletion.mockRejectedValue(networkError());
    await enqueue(USER, completionInput());
    await enqueue(USER, reviewInput());

    for (let i = 0; i < OFFLINE_QUEUE_MAX_ATTEMPTS; i++) {
      await flush(USER);
    }

    expect(mockUpsertCompletion).toHaveBeenCalledTimes(OFFLINE_QUEUE_MAX_ATTEMPTS);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('dead-letter'),
      'error',
    );
    // The dead-lettered item is gone and the flush moved on to the next one.
    expect(mockUpsertReview).toHaveBeenCalledTimes(1);
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
          type: 'exercise-result',
          payload: { exerciseId: 'ex-1', correct: true, attempts: 1, responseTimeMs: 0, clientResultId: 'er:old' },
          createdAt: now - OFFLINE_QUEUE_TTL_MS - 60_000,
          attempts: 0,
        },
        {
          id: 'fresh',
          type: 'exercise-result',
          payload: { exerciseId: 'ex-2', correct: true, attempts: 1, responseTimeMs: 0, clientResultId: 'er:fresh' },
          createdAt: now - 60_000,
          attempts: 0,
        },
      ],
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(envelope));

    await flush(USER);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    // captureMessage, not addBreadcrumb: a breadcrumb only rides along with a
    // later event, so a silent data loss that crashes nothing is never sent.
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('expired'),
      'error',
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
      await enqueue(USER, resultInput(`er:cap:${String(i).padStart(8, '0')}`));
    }
    const items = await storedItems();
    expect(items).toHaveLength(OFFLINE_QUEUE_MAX_ITEMS);
    // oldest (index 0) was dropped
    expect((items[0].payload as { clientResultId: string }).clientResultId).toBe('er:cap:00000001');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('queue full'),
      'exercise-result',
      expect.any(String),
    );
  });
});

describe('invalid stored payloads', () => {
  it('discards corrupt JSON', async () => {
    await AsyncStorage.setItem(KEY, 'not-json{');
    await flush(USER);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
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
        { id: 'bad', type: 'xp-award', payload: { amount: 20 }, key: 'xp:old:12345678', createdAt: Date.now(), attempts: 0 }, // retired type
        {
          id: 'good',
          type: 'lesson-completion',
          payload: { lessonId: 'l', courseId: 'c', score: 1, timeSpentMs: 0 },
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

describe('review-log replay', () => {
  function logPayload(overrides: Partial<ReviewLogPayload> = {}): ReviewLogPayload {
    return {
      userId: USER,
      cardId: 'card-1',
      reviewItemId: 'ri-1',
      rating: 4,
      responseTimeMs: 1200,
      userAnswer: 'la manzana',
      wasCorrect: true,
      reviewedAt: new Date().toISOString(),
      clientLogId: newClientLogId(),
      ...overrides,
    };
  }

  it('round-trips through the queue and replays once', async () => {
    const payload = logPayload();
    await enqueue(USER, { type: 'review-log', payload });
    const processed = await flush(USER);
    expect(processed).toBe(1);
    expect(mockInsertReviewLog).toHaveBeenCalledWith(payload);
  });

  it('preserves the client id across a retry so the replay is the same review', async () => {
    // The id is minted at submit time precisely so a retry is de-duplicated by
    // the database rather than inserted twice.
    const payload = logPayload();
    mockInsertReviewLog.mockRejectedValueOnce(new Error('Network request failed'));
    await enqueue(USER, { type: 'review-log', payload });
    await flush(USER);
    await flush(USER);
    const ids = mockInsertReviewLog.mock.calls.map((c) => c[0].clientLogId);
    expect(new Set(ids).size).toBe(1);
  });

  it('resolves an empty reviewItemId from the card at replay time', async () => {
    // A first-seen card answered offline: the log was queued before its
    // review_items row existed. The upsert ahead of it in the queue has
    // replayed by now, so the row is there to be looked up.
    mockFetchByCardIds.mockResolvedValue([{ id: 'ri-created', cardId: 'card-1' }]);
    const payload = logPayload({ reviewItemId: '' });
    await enqueue(USER, { type: 'review-log', payload });

    expect(await flush(USER)).toBe(1);
    expect(mockFetchByCardIds).toHaveBeenCalledWith(USER, ['card-1']);
    expect(mockInsertReviewLog).toHaveBeenCalledWith({ ...payload, reviewItemId: 'ri-created' });
  });

  it('dead-letters an unresolvable empty reviewItemId as a non-network failure', async () => {
    // No row means the upsert ahead of it was dead-lettered or skipped as
    // stale; retrying for ten flushes would not create one.
    mockFetchByCardIds.mockResolvedValue([]);
    await enqueue(USER, { type: 'review-log', payload: logPayload({ reviewItemId: '' }) });

    for (let i = 0; i < OFFLINE_QUEUE_MAX_NON_NETWORK_ATTEMPTS; i++) await flush(USER);

    expect(mockInsertReviewLog).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('dead-letter'), 'error');
  });

  it('rejects a stored review-log with no client id', async () => {
    // Without one it cannot be replayed idempotently, so it must not survive
    // a reload rather than risk double-logging.
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        version: OFFLINE_QUEUE_SCHEMA_VERSION,
        items: [
          {
            id: 'x',
            createdAt: Date.now(),
            attempts: 0,
            type: 'review-log',
            payload: { userId: USER, cardId: 'c', rating: 4 },
          },
        ],
      }),
    );
    expect(await flush(USER)).toBe(0);
    expect(mockInsertReviewLog).not.toHaveBeenCalled();
  });
});

describe('exercise-result replay', () => {
  function resultPayload(overrides: Partial<ExerciseResultPayload> = {}): ExerciseResultPayload {
    return {
      exerciseId: '123e4567-e89b-12d3-a456-426614174000',
      correct: true,
      attempts: 1,
      responseTimeMs: 1800,
      clientResultId: newClientResultId(),
      ...overrides,
    };
  }

  it('round-trips through the queue and replays the RPC once', async () => {
    const payload = resultPayload();
    await enqueue(USER, { type: 'exercise-result', payload });
    expect(await flush(USER)).toBe(1);
    expect(mockRecordExerciseResult).toHaveBeenCalledWith(payload);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('preserves the client id across a retry so the replay is the same result', async () => {
    const payload = resultPayload();
    mockRecordExerciseResult.mockRejectedValueOnce(networkError());
    await enqueue(USER, { type: 'exercise-result', payload });
    await flush(USER);
    await flush(USER);
    const ids = mockRecordExerciseResult.mock.calls.map((c) => c[0].clientResultId);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(1);
  });

  it('rejects a stored exercise-result with no client id', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        version: OFFLINE_QUEUE_SCHEMA_VERSION,
        items: [
          {
            id: 'x',
            createdAt: Date.now(),
            attempts: 0,
            type: 'exercise-result',
            payload: { exerciseId: 'e', correct: true, attempts: 1, responseTimeMs: 1 },
          },
        ],
      }),
    );
    expect(await flush(USER)).toBe(0);
    expect(mockRecordExerciseResult).not.toHaveBeenCalled();
  });
});

describe('newClientLogId', () => {
  it('produces distinct ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newClientLogId()));
    expect(ids.size).toBe(200);
  });
});

describe('newClientResultId', () => {
  it('produces distinct ids with a prefix no review-log id shares', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newClientResultId()));
    expect(ids.size).toBe(200);
    expect(newClientResultId().startsWith('er:')).toBe(true);
    expect(newClientLogId().startsWith('er:')).toBe(false);
  });
});
