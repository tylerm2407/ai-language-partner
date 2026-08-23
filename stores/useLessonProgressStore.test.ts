/**
 * Unit tests for stores/useLessonProgressStore.
 *
 * These pin the behaviour that was actually broken: a finished lesson has to
 * be visible to every screen immediately, and it must never be dropped
 * silently when the write fails.
 *
 * supabase-queries, the offline queue and Sentry are mocked so nothing
 * touches the network or a native module.
 */
import { useLessonProgressStore } from './useLessonProgressStore';
import { fetchLessonCompletions, upsertLessonCompletion } from '../lib/supabase-queries';
import { enqueue, isNetworkError } from '../lib/offline-queue';
import type { LessonCompletion } from '../types';

jest.mock('../lib/supabase-queries', () => ({
  fetchLessonCompletions: jest.fn(),
  upsertLessonCompletion: jest.fn(),
}));

jest.mock('../lib/offline-queue', () => ({
  enqueue: jest.fn(async () => {}),
  // Real heuristic — the store's branch on it is part of what's under test.
  isNetworkError: jest.fn((err: unknown) =>
    /network request failed|failed to fetch/i.test(
      err instanceof Error ? err.message : String(err),
    ),
  ),
}));

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

const mockFetch = fetchLessonCompletions as jest.MockedFunction<typeof fetchLessonCompletions>;
const mockUpsert = upsertLessonCompletion as jest.MockedFunction<typeof upsertLessonCompletion>;
const mockEnqueue = enqueue as jest.MockedFunction<typeof enqueue>;

const USER = 'user-1';
const COURSE = 'course-1';

function completion(lessonId: string, overrides: Partial<LessonCompletion> = {}): LessonCompletion {
  return {
    id: `row-${lessonId}`,
    userId: USER,
    lessonId,
    courseId: COURSE,
    score: 0.8,
    xpEarned: 15,
    timeSpentMs: 1000,
    completedAt: '2026-08-23T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useLessonProgressStore.getState().reset();
  mockFetch.mockResolvedValue([]);
  mockUpsert.mockImplementation(async (userId, lessonId, courseId, score, xpEarned, timeSpentMs) =>
    completion(lessonId, { userId, courseId, score, xpEarned, timeSpentMs }),
  );
});

describe('load', () => {
  it('populates the map from the server', async () => {
    mockFetch.mockResolvedValue([completion('lesson-a'), completion('lesson-b')]);
    await useLessonProgressStore.getState().load(USER);

    const state = useLessonProgressStore.getState();
    expect(state.loading).toBe(false);
    expect(state.completions.has('lesson-a')).toBe(true);
    expect(state.completions.has('lesson-b')).toBe(true);
  });

  it('fetches every course at once, so switching course needs no reload', async () => {
    await useLessonProgressStore.getState().load(USER);
    // No courseId argument — a per-course fetch is what used to leave the
    // carousel showing "all locked" on the course the learner switched to.
    expect(mockFetch).toHaveBeenCalledWith(USER);
  });

  it('shares one request between concurrent callers', async () => {
    // Every screen mounting at once must not fan out into N identical reads.
    const store = useLessonProgressStore.getState();
    await Promise.all([store.load(USER), store.load(USER), store.load(USER)]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not refetch once loaded', async () => {
    await useLessonProgressStore.getState().load(USER);
    await useLessonProgressStore.getState().load(USER);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces a load failure instead of rendering an empty map as truth', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));
    await useLessonProgressStore.getState().load(USER);
    const state = useLessonProgressStore.getState();
    expect(state.error).toBe('boom');
    expect(state.loading).toBe(false);
  });

  it('drops the previous account\'s completions when the user changes', async () => {
    mockFetch.mockResolvedValue([completion('lesson-a')]);
    await useLessonProgressStore.getState().load(USER);

    mockFetch.mockResolvedValue([]);
    await useLessonProgressStore.getState().load('user-2');
    expect(useLessonProgressStore.getState().completions.size).toBe(0);
  });
});

describe('markComplete', () => {
  it('records the completion in the shared map for every consumer', async () => {
    await useLessonProgressStore.getState().load(USER);
    await useLessonProgressStore.getState().markComplete(USER, 'lesson-a', COURSE, 0.9, 18, 5000);

    const stored = useLessonProgressStore.getState().completions.get('lesson-a');
    expect(stored?.xpEarned).toBe(18);
    expect(stored?.timeSpentMs).toBe(5000);
  });

  it('shows the lesson as complete before the write resolves', async () => {
    let release: (value: LessonCompletion) => void = () => {};
    mockUpsert.mockImplementation(
      () => new Promise<LessonCompletion>((resolve) => { release = resolve; }),
    );

    const pending = useLessonProgressStore
      .getState()
      .markComplete(USER, 'lesson-a', COURSE, 1, 20, 0);

    // The learner advances now, not after the round trip.
    expect(useLessonProgressStore.getState().completions.has('lesson-a')).toBe(true);
    release(completion('lesson-a'));
    await pending;
    expect(useLessonProgressStore.getState().completions.get('lesson-a')?.id).toBe('row-lesson-a');
  });

  it('reports persisted:true once the row is in Postgres', async () => {
    const result = await useLessonProgressStore
      .getState()
      .markComplete(USER, 'lesson-a', COURSE, 1, 20, 0);
    expect(result.persisted).toBe(true);
  });

  it('queues the completion when the network is down', async () => {
    mockUpsert.mockRejectedValue(new Error('Network request failed'));
    const result = await useLessonProgressStore
      .getState()
      .markComplete(USER, 'lesson-a', COURSE, 0.5, 10, 0);

    expect(result.persisted).toBe(false);
    expect(mockEnqueue).toHaveBeenCalledWith(USER, {
      type: 'lesson-completion',
      payload: { lessonId: 'lesson-a', courseId: COURSE, score: 0.5, xpEarned: 10, timeSpentMs: 0 },
    });
    // The learner still advances.
    expect(useLessonProgressStore.getState().completions.has('lesson-a')).toBe(true);
  });

  it('queues a NON-network failure too rather than losing the lesson', async () => {
    // This is the case that lost work before: a 4xx/5xx went to console.error
    // and the completion simply never existed.
    mockUpsert.mockRejectedValue(new Error('duplicate key value violates constraint'));
    const result = await useLessonProgressStore
      .getState()
      .markComplete(USER, 'lesson-a', COURSE, 0.5, 10, 0);

    expect(isNetworkError).toHaveBeenCalled();
    expect(result.persisted).toBe(false);
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(useLessonProgressStore.getState().completions.has('lesson-a')).toBe(true);
  });
});

describe('refresh', () => {
  it('keeps a completion the server has not caught up with yet', async () => {
    // Marked complete offline (queued), then a refresh runs before the queue
    // replays. Dropping it here would walk the learner back a lesson.
    mockUpsert.mockRejectedValue(new Error('Network request failed'));
    await useLessonProgressStore.getState().markComplete(USER, 'lesson-a', COURSE, 1, 20, 0);

    mockFetch.mockResolvedValue([completion('lesson-b')]);
    await useLessonProgressStore.getState().refresh(USER);

    const { completions } = useLessonProgressStore.getState();
    expect(completions.has('lesson-a')).toBe(true);
    expect(completions.has('lesson-b')).toBe(true);
  });

  it('re-reads even when already loaded', async () => {
    await useLessonProgressStore.getState().load(USER);
    await useLessonProgressStore.getState().refresh(USER);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('revalidates silently once there is data on screen', async () => {
    // The Learn tab refreshes on every focus. If that flipped `loading`, the
    // learner would get a spinner in place of their path each time they came
    // back from a lesson.
    mockFetch.mockResolvedValue([completion('lesson-a')]);
    await useLessonProgressStore.getState().load(USER);

    let loadingDuringRefresh: boolean | null = null;
    mockFetch.mockImplementation(async () => {
      loadingDuringRefresh = useLessonProgressStore.getState().loading;
      return [completion('lesson-a')];
    });
    await useLessonProgressStore.getState().refresh(USER);

    expect(loadingDuringRefresh).toBe(false);
    // ...but the very first load does block, since there is nothing to show.
    useLessonProgressStore.getState().reset();
    const first = useLessonProgressStore.getState().refresh(USER);
    expect(useLessonProgressStore.getState().loading).toBe(true);
    await first;
  });
});
