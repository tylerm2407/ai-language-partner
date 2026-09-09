/**
 * Offline packs: manifest, the three downloaders, budget eviction and the
 * Wi-Fi top-up — with AsyncStorage and expo-file-system replaced by the same
 * in-memory doubles read-cache.test.ts and tts-cache.test.ts use.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  autoTopUp,
  clearAllPacks,
  downloadBookPack,
  downloadNewsPack,
  downloadUnitPack,
  enforcePackBudget,
  findPack,
  formatBytes,
  jsonBytes,
  listPacks,
  localNewsAudioUri,
  newsCacheKey,
  offlinePacksEntitled,
  OFFLINE_PACKS_RETENTION_MS,
  removePack,
  setAutoDownload,
  touchPack,
  type PackDeps,
} from './offline-packs';
import { getCached, readCacheKey } from './read-cache';
import type { Lesson, Unit } from '../types';

// Every network effect is injected through `deps`; the real query module
// would drag lib/supabase.ts (and its env check) into the test.
jest.mock('./supabase-queries', () => ({
  fetchBookAnnotations: jest.fn(),
  fetchBookContent: jest.fn(),
  fetchBookMeta: jest.fn(),
  fetchCourses: jest.fn(),
  fetchDailyNews: jest.fn(),
  fetchInProgressBooks: jest.fn(),
  fetchLessonCompletions: jest.fn(),
  fetchLessonWithExercises: jest.fn(),
  fetchLessons: jest.fn(),
  fetchNewsAudio: jest.fn(),
  fetchUnits: jest.fn(),
}));

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
      multiRemove: jest.fn(async (keys: string[]) => {
        keys.forEach((key) => delete store[key]);
      }),
      getAllKeys: jest.fn(async () => Object.keys(store)),
      clear: jest.fn(async () => {
        store = {};
      }),
    },
  };
});

const mockFiles = new Map<string, number>();
jest.mock('expo-file-system', () => {
  const join = (...parts: unknown[]): string =>
    parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/').replace(/\/+/g, '/');
  class MockFile {
    uri: string;
    constructor(...uris: unknown[]) {
      this.uri = join(...uris);
    }
    get exists(): boolean {
      return mockFiles.has(this.uri);
    }
    get size(): number {
      return mockFiles.get(this.uri) ?? 0;
    }
    delete(): void {
      mockFiles.delete(this.uri);
    }
    static downloadFileAsync = jest.fn(async () => '');
  }
  class MockDirectory {
    uri: string;
    constructor(...uris: unknown[]) {
      this.uri = join(...uris);
    }
    get exists(): boolean {
      return true;
    }
    create(): void {}
  }
  return { File: MockFile, Directory: MockDirectory, Paths: { cache: 'file:///cache' } };
});

const USER = 'user-1';
const NOW = Date.parse('2026-09-09T12:00:00Z');

const unit = (id: string, orderIndex: number): Unit => ({
  id, courseId: 'course-1', title: `Unit ${orderIndex + 1}`, description: '', orderIndex, totalLessons: 2,
});
const lesson = (id: string, unitId: string): Lesson =>
  ({ id, unitId, courseId: 'course-1', title: id, description: '', orderIndex: 0, estimatedMinutes: 5, xpReward: 20, exercises: [] }) as unknown as Lesson;

function deps(over: Partial<PackDeps> = {}): { deps: PackDeps; calls: Record<string, number> } {
  const calls: Record<string, number> = {};
  const count = (k: string) => { calls[k] = (calls[k] ?? 0) + 1; };
  const base: PackDeps = {
    fetchCourses: async () => { count('courses'); return [{ id: 'course-1' } as never]; },
    fetchUnits: async () => { count('units'); return [unit('u1', 0), unit('u2', 1), unit('u3', 2), unit('u4', 3)]; },
    fetchLessons: async (unitId) => { count('lessons'); return [lesson(`${unitId}-l1`, unitId), lesson(`${unitId}-l2`, unitId)]; },
    fetchLessonWithExercises: async (lessonId) => { count('lesson'); return { ...lesson(lessonId, lessonId.split('-')[0]), exercises: [{ id: 'e1' }] } as unknown as Lesson; },
    fetchLessonCompletions: async () => { count('completions'); return [{ lessonId: 'u1-l1' }, { lessonId: 'u1-l2' }] as never; },
    fetchBookMeta: async (bookId) => { count('bookMeta'); return { id: bookId, title: 'Niebla', language: 'es' } as never; },
    fetchBookContent: async () => { count('bookContent'); return 'Érase una vez…'; },
    fetchBookAnnotations: async () => { count('bookAnn'); return []; },
    fetchInProgressBooks: async () => { count('inProgress'); return [{ book: { id: 'book-9', title: 'Niebla', language: 'es' } as never }]; },
    fetchDailyNews: async (language, tier, date) => { count('news'); return { id: 'art-1', date: date ?? '2026-09-09', language, tier, title: 'Hoy' } as never; },
    fetchNewsAudio: async () => { count('newsAudio'); return { status: 'ready', url: 'https://cdn/x.mp3', durationMs: 1000 } as never; },
    downloadFile: async (_url, uri) => { count('download'); mockFiles.set(uri, 512_000); return 512_000; },
  };
  return { deps: { ...base, ...over }, calls };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockFiles.clear();
});

describe('entitlement', () => {
  it('is a plan property, not a client guess', () => {
    expect(offlinePacksEntitled('starter')).toBe(false);
    expect(offlinePacksEntitled('basic')).toBe(false);
    expect(offlinePacksEntitled('premium')).toBe(true);
    expect(offlinePacksEntitled('vip')).toBe(true);
    expect(offlinePacksEntitled(null)).toBe(false);
  });
});

describe('unit packs', () => {
  it('warms the exact keys the lesson screens read, and lists the pack', async () => {
    const { deps: d } = deps();
    const progress: number[] = [];
    const pack = await downloadUnitPack(USER, { courseId: 'course-1', unitId: 'u2', title: 'Unit 2', language: 'es' }, {
      deps: d, now: NOW, onProgress: (p) => progress.push(p.done),
    });
    expect(pack.id).toBe('unit:u2');
    expect(pack.keys).toEqual([readCacheKey('lessons', 'u2'), readCacheKey('lesson', 'u2-l1'), readCacheKey('lesson', 'u2-l2')]);
    expect(await getCached(readCacheKey('lesson', 'u2-l1'))).toMatchObject({ id: 'u2-l1' });
    expect(progress).toEqual([0, 1, 2]);
    expect(pack.bytes).toBeGreaterThan(0);
    expect((await listPacks(USER)).map((p) => p.id)).toEqual(['unit:u2']);
  });

  it('rolls back a half-downloaded unit rather than promising lessons that 404 offline', async () => {
    const { deps: d } = deps({
      fetchLessonWithExercises: async (id) => {
        if (id === 'u2-l2') throw new Error('network');
        return lesson(id, 'u2');
      },
    });
    await expect(downloadUnitPack(USER, { courseId: 'course-1', unitId: 'u2', title: 'Unit 2', language: 'es' }, { deps: d })).rejects.toThrow('network');
    expect(await getCached(readCacheKey('lessons', 'u2'))).toBeNull();
    expect(await getCached(readCacheKey('lesson', 'u2-l1'))).toBeNull();
    expect(await listPacks(USER)).toEqual([]);
  });
});

describe('book and news packs', () => {
  it('a book pack carries meta, annotations and the text', async () => {
    const { deps: d } = deps();
    const pack = await downloadBookPack(USER, { bookId: 'book-9', title: 'Niebla', language: 'es' }, { deps: d, now: NOW });
    expect(pack.keys).toEqual([readCacheKey('book-meta', 'book-9'), readCacheKey('book-annotations', 'book-9'), readCacheKey('book-content', 'book-9')]);
    expect(await getCached(readCacheKey('book-content', 'book-9'))).toBe('Érase una vez…');
  });

  it('a news pack stores the article under the key useDailyNews reads, and the narration on disk', async () => {
    const { deps: d } = deps();
    const pack = await downloadNewsPack(USER, { language: 'es', tier: 'easy', date: '2026-09-09' }, { deps: d, now: NOW });
    expect(pack.keys).toEqual([newsCacheKey('es', 'easy', '2026-09-09')]);
    expect(pack.files).toHaveLength(1);
    expect(pack.bytes).toBeGreaterThan(512_000);
    expect(await localNewsAudioUri(USER, 'art-1')).toBe(pack.files[0]);
  });

  it('a narration that is not ready leaves a text-only pack rather than failing', async () => {
    const { deps: d } = deps({ fetchNewsAudio: async () => null });
    const pack = await downloadNewsPack(USER, { language: 'es', tier: 'easy' }, { deps: d, now: NOW });
    expect(pack.files).toEqual([]);
    expect(await localNewsAudioUri(USER, 'art-1')).toBeNull();
  });

  it('no article yet is an error the caller can name', async () => {
    const { deps: d } = deps({ fetchDailyNews: async () => null });
    await expect(downloadNewsPack(USER, { language: 'es', tier: 'easy' }, { deps: d })).rejects.toThrow('No article yet');
  });
});

describe('removal and budget', () => {
  it('removing a pack drops its keys and files', async () => {
    const { deps: d } = deps();
    const pack = await downloadNewsPack(USER, { language: 'es', tier: 'easy', date: '2026-09-09' }, { deps: d, now: NOW });
    await removePack(USER, pack.id);
    expect(await getCached(pack.keys[0])).toBeNull();
    expect(mockFiles.has(pack.files[0])).toBe(false);
    expect(await listPacks(USER)).toEqual([]);
  });

  it('evicts past retention first, then least recently used until under budget', async () => {
    const { deps: d } = deps();
    const old = await downloadUnitPack(USER, { courseId: 'course-1', unitId: 'u1', title: 'Unit 1', language: 'es' }, { deps: d, now: NOW - OFFLINE_PACKS_RETENTION_MS - 1 });
    const a = await downloadNewsPack(USER, { language: 'es', tier: 'easy', date: '2026-09-08' }, { deps: { ...d, fetchDailyNews: async () => ({ id: 'art-a', date: '2026-09-08', title: 'A' } as never) }, now: NOW - 2000 });
    const b = await downloadNewsPack(USER, { language: 'es', tier: 'easy', date: '2026-09-09' }, { deps: { ...d, fetchDailyNews: async () => ({ id: 'art-b', date: '2026-09-09', title: 'B' } as never) }, now: NOW - 1000 });
    await touchPack(USER, 'news', 'art-a', NOW); // a is now the most recently used

    const { evicted } = await enforcePackBudget(USER, NOW, 600_000);
    expect(evicted).toEqual([old.id, b.id]);
    expect((await listPacks(USER)).map((p) => p.id)).toEqual([a.id]);
  });

  it('clearAll leaves nothing behind', async () => {
    const { deps: d } = deps();
    await downloadUnitPack(USER, { courseId: 'course-1', unitId: 'u1', title: 'Unit 1', language: 'es' }, { deps: d, now: NOW });
    await downloadNewsPack(USER, { language: 'es', tier: 'easy', date: '2026-09-09' }, { deps: d, now: NOW });
    await clearAllPacks(USER);
    expect(await listPacks(USER)).toEqual([]);
    expect(await getCached(readCacheKey('lesson', 'u1-l1'))).toBeNull();
    expect(mockFiles.size).toBe(0);
  });
});

describe('auto top-up', () => {
  it('packs the current unit and the next, started books, and today\'s article', async () => {
    const { deps: d, calls } = deps();
    const summary = await autoTopUp(USER, { targetLanguage: 'es', newsTier: 'easy', date: '2026-09-09' }, { deps: d, now: NOW });
    // u1 is finished (both lessons completed), so the current unit is u2.
    expect((await listPacks(USER)).map((p) => p.id).sort()).toEqual(['book:book-9', 'news:art-1', 'unit:u2', 'unit:u3']);
    expect(summary).toMatchObject({ units: 2, books: 1, news: 1, errors: 0, skipped: null });
    expect(calls.lesson).toBe(4);
  });

  it('does nothing when the learner turned auto-download off', async () => {
    const { deps: d, calls } = deps();
    await setAutoDownload(USER, false);
    const summary = await autoTopUp(USER, { targetLanguage: 'es', newsTier: 'easy' }, { deps: d, now: NOW });
    expect(summary.skipped).toBe('off');
    expect(calls.courses).toBeUndefined();
  });

  it('skips packs already on the device and re-fetches only a news pack that lacks audio', async () => {
    const { deps: d, calls } = deps();
    await autoTopUp(USER, { targetLanguage: 'es', newsTier: 'easy', date: '2026-09-09' }, { deps: d, now: NOW });
    const before = { ...calls };
    const again = await autoTopUp(USER, { targetLanguage: 'es', newsTier: 'easy', date: '2026-09-09' }, { deps: d, now: NOW });
    expect(again).toMatchObject({ units: 0, books: 0, news: 0 });
    expect(calls.lesson).toBe(before.lesson);
    expect(await findPack(USER, 'unit', 'u2')).not.toBeNull();
  });

  it('a missing article is the normal morning state, not an error', async () => {
    const { deps: d } = deps({ fetchDailyNews: async () => null });
    const summary = await autoTopUp(USER, { targetLanguage: 'es', newsTier: 'easy' }, { deps: d, now: NOW });
    expect(summary.errors).toBe(0);
    expect(summary.news).toBe(0);
  });
});

describe('helpers', () => {
  it('jsonBytes counts UTF-8, not JS string length', () => {
    expect(jsonBytes('a')).toBe(3); // "a" with quotes
    expect(jsonBytes('é')).toBe(4);
  });
  it('formatBytes reads like a settings row', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(20 * 1024)).toBe('20 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatBytes(120 * 1024 * 1024)).toBe('120 MB');
  });
});
