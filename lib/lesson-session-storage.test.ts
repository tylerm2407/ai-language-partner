/**
 * Unit tests for lib/lesson-session-storage.ts.
 *
 * AsyncStorage is replaced with a simple in-memory mock (no other test in
 * the repo touches AsyncStorage yet, so there's no shared mock to reuse).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LESSON_SESSION_SCHEMA_VERSION,
  LESSON_SESSION_TTL_MS,
  lessonSessionKey,
  saveLessonSession,
  loadLessonSession,
  clearLessonSession,
} from './lesson-session-storage';

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

const USER = 'user-1';
const LESSON = 'lesson-abc';
const KEY = lessonSessionKey(USER, LESSON);

function makeSnapshot(overrides: Partial<{ exerciseIndex: number; startedAt: number }> = {}) {
  return {
    exerciseIndex: 3,
    answers: [
      { exerciseId: 'ex-1', correct: true, answer: 'hola' },
      { exerciseId: 'ex-2', correct: false, answer: 'adios' },
    ],
    startedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('lessonSessionKey', () => {
  it('namespaces by user and lesson', () => {
    expect(lessonSessionKey('u', 'l')).toBe('lesson-session:u:l');
  });
});

describe('save / load round-trip', () => {
  it('round-trips a snapshot with the current schema version', async () => {
    const snapshot = { ...makeSnapshot(), picks: { 'ex-1': 'hola', 'ex-2': 'adios' } };
    await saveLessonSession(USER, LESSON, snapshot);
    const loaded = await loadLessonSession(USER, LESSON);
    expect(loaded).toEqual({ version: LESSON_SESSION_SCHEMA_VERSION, ...snapshot });
  });

  it('preserves picks that differ from the graded answer', async () => {
    // A retry replaces the recorded answer; the pick map is what the UI
    // restores, so the two are stored separately rather than derived.
    const snapshot = {
      ...makeSnapshot(),
      picks: { 'ex-1': 'hola', 'ex-2': 'adiós' },
    };
    await saveLessonSession(USER, LESSON, snapshot);
    const loaded = await loadLessonSession(USER, LESSON);
    expect(loaded?.picks).toEqual({ 'ex-1': 'hola', 'ex-2': 'adiós' });
  });

  it('rebuilds picks for a snapshot written before the field existed', async () => {
    // A learner mid-lesson when the exercise chrome shipped must not lose
    // their place: every answer already carries the text they submitted, so
    // the pick map is recoverable instead of dropping the session.
    const legacy = makeSnapshot();
    await saveLessonSession(USER, LESSON, legacy);
    // Strip `picks` back out to simulate the old on-disk shape.
    const raw = JSON.parse((await AsyncStorage.getItem(KEY)) as string);
    delete raw.picks;
    await AsyncStorage.setItem(KEY, JSON.stringify(raw));

    const loaded = await loadLessonSession(USER, LESSON);
    expect(loaded?.picks).toEqual({ 'ex-1': 'hola', 'ex-2': 'adios' });
    expect(loaded?.exerciseIndex).toBe(3);
  });

  it('rebuilds an empty pick map when there are no answers yet', async () => {
    await saveLessonSession(USER, LESSON, { ...makeSnapshot(), answers: [] });
    const raw = JSON.parse((await AsyncStorage.getItem(KEY)) as string);
    delete raw.picks;
    await AsyncStorage.setItem(KEY, JSON.stringify(raw));

    const loaded = await loadLessonSession(USER, LESSON);
    expect(loaded?.picks).toEqual({});
  });

  it('returns null when nothing was saved', async () => {
    expect(await loadLessonSession(USER, LESSON)).toBeNull();
  });

  it('does not leak snapshots across users or lessons', async () => {
    await saveLessonSession(USER, LESSON, makeSnapshot());
    expect(await loadLessonSession('user-2', LESSON)).toBeNull();
    expect(await loadLessonSession(USER, 'lesson-other')).toBeNull();
    expect(await loadLessonSession(USER, LESSON)).not.toBeNull();
  });

  it('overwrites a previous snapshot for the same user + lesson', async () => {
    await saveLessonSession(USER, LESSON, makeSnapshot({ exerciseIndex: 1 }));
    await saveLessonSession(USER, LESSON, makeSnapshot({ exerciseIndex: 7 }));
    const loaded = await loadLessonSession(USER, LESSON);
    expect(loaded?.exerciseIndex).toBe(7);
  });
});

describe('TTL', () => {
  it('discards and removes snapshots older than 24h', async () => {
    await saveLessonSession(
      USER,
      LESSON,
      makeSnapshot({ startedAt: Date.now() - LESSON_SESSION_TTL_MS - 60_000 }),
    );
    expect(await loadLessonSession(USER, LESSON)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull(); // entry cleaned up
  });

  it('keeps snapshots younger than 24h', async () => {
    await saveLessonSession(
      USER,
      LESSON,
      makeSnapshot({ startedAt: Date.now() - LESSON_SESSION_TTL_MS + 60_000 }),
    );
    expect(await loadLessonSession(USER, LESSON)).not.toBeNull();
  });
});

describe('invalid payloads', () => {
  it('discards and removes corrupt JSON', async () => {
    await AsyncStorage.setItem(KEY, 'not-json{');
    expect(await loadLessonSession(USER, LESSON)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('discards snapshots from a different schema version', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ ...makeSnapshot(), version: LESSON_SESSION_SCHEMA_VERSION + 1 }),
    );
    expect(await loadLessonSession(USER, LESSON)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('discards structurally invalid snapshots', async () => {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ version: LESSON_SESSION_SCHEMA_VERSION, answers: 'nope' }),
    );
    expect(await loadLessonSession(USER, LESSON)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});

describe('clearLessonSession', () => {
  it('removes the snapshot', async () => {
    await saveLessonSession(USER, LESSON, makeSnapshot());
    await clearLessonSession(USER, LESSON);
    expect(await loadLessonSession(USER, LESSON)).toBeNull();
  });

  it('is a no-op when nothing exists', async () => {
    await expect(clearLessonSession(USER, LESSON)).resolves.toBeUndefined();
  });
});
