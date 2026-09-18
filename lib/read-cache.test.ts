/**
 * Unit tests for lib/read-cache.ts.
 *
 * AsyncStorage and expo-file-system are replaced with in-memory mocks (same
 * pattern as lib/lesson-session-storage.test.ts and lib/offline-packs.test.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  READ_CACHE_OVERFLOW_BYTES,
  READ_CACHE_SCHEMA_VERSION,
  READ_CACHE_TTL_MS,
  readCacheKey,
  getCached,
  setCached,
  cachedFetch,
  clearReadCache,
  removeCached,
} from './read-cache';

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

const mockFiles = new Map<string, string>();
jest.mock('expo-file-system', () => {
  const join = (...parts: unknown[]): string =>
    parts
      .map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri))
      .join('/')
      .replace(/\/+/g, '/');
  class MockFile {
    uri: string;
    constructor(...uris: unknown[]) {
      this.uri = join(...uris);
    }
    get exists(): boolean {
      return mockFiles.has(this.uri);
    }
    create(): void {
      if (!mockFiles.has(this.uri)) mockFiles.set(this.uri, '');
    }
    write(content: string): void {
      mockFiles.set(this.uri, content);
    }
    textSync(): string {
      const text = mockFiles.get(this.uri);
      if (text === undefined) throw new Error(`no such file: ${this.uri}`);
      return text;
    }
    delete(): void {
      mockFiles.delete(this.uri);
    }
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
    delete(): void {
      for (const uri of [...mockFiles.keys()]) {
        if (uri.startsWith(this.uri)) mockFiles.delete(uri);
      }
    }
  }
  return { File: MockFile, Directory: MockDirectory, Paths: { cache: 'file:///cache' } };
});

const KEY = readCacheKey('units', 'course-1');
/** A payload comfortably over the overflow threshold. */
const big = (): string[] => [ 'x'.repeat(READ_CACHE_OVERFLOW_BYTES + 1024) ];

/** Write a raw entry directly, bypassing setCached, to control v / at. */
async function writeRawEntry(key: string, entry: { v: number; at: number; data: unknown }) {
  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

let warnSpy: jest.SpyInstance;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockFiles.clear();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('readCacheKey', () => {
  it('joins parts under the read-cache prefix', () => {
    expect(readCacheKey('units', 'c-1')).toBe('read-cache:units:c-1');
    expect(readCacheKey('courses')).toBe('read-cache:courses');
  });
});

describe('getCached / setCached', () => {
  it('round-trips a value', async () => {
    await setCached(KEY, { name: 'Unit 1', order: 2 });
    expect(await getCached(KEY)).toEqual({ name: 'Unit 1', order: 2 });
  });

  it('returns null when nothing was cached', async () => {
    expect(await getCached(KEY)).toBeNull();
  });

  it('discards and removes corrupt JSON', async () => {
    await AsyncStorage.setItem(KEY, 'not-json{');
    expect(await getCached(KEY)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('discards and removes entries from a different schema version', async () => {
    await writeRawEntry(KEY, { v: READ_CACHE_SCHEMA_VERSION + 1, at: Date.now(), data: [1] });
    expect(await getCached(KEY)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('discards and removes structurally invalid entries', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ hello: 'world' }));
    expect(await getCached(KEY)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('discards and removes entries past the default 30-day TTL', async () => {
    await writeRawEntry(KEY, {
      v: READ_CACHE_SCHEMA_VERSION,
      at: Date.now() - READ_CACHE_TTL_MS - 60_000,
      data: [1],
    });
    expect(await getCached(KEY)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('keeps entries younger than the TTL', async () => {
    await writeRawEntry(KEY, {
      v: READ_CACHE_SCHEMA_VERSION,
      at: Date.now() - READ_CACHE_TTL_MS + 60_000,
      data: [1],
    });
    expect(await getCached(KEY)).toEqual([1]);
  });

  it('honours a custom ttlMs', async () => {
    await writeRawEntry(KEY, {
      v: READ_CACHE_SCHEMA_VERSION,
      at: Date.now() - 10_000,
      data: [1],
    });
    expect(await getCached(KEY, 5_000)).toBeNull();
  });
});

describe('cachedFetch', () => {
  it('cache miss: fetches, stores, and returns fresh data without calling onCached', async () => {
    const fetcher = jest.fn(async () => ['fresh']);
    const onCached = jest.fn();

    const result = await cachedFetch(KEY, fetcher, { onCached });

    expect(result).toEqual({ data: ['fresh'], stale: false });
    expect(onCached).not.toHaveBeenCalled();
    expect(await getCached(KEY)).toEqual(['fresh']); // revalidated cache
  });

  it('cache hit fast-path: onCached fires with cached data before the fetcher resolves', async () => {
    await setCached(KEY, ['cached']);

    let resolveFetch!: (value: string[]) => void;
    const fetcher = jest.fn(
      () => new Promise<string[]>((resolve) => { resolveFetch = resolve; }),
    );
    const onCached = jest.fn();

    const pending = cachedFetch(KEY, fetcher, { onCached });
    await new Promise((resolve) => setTimeout(resolve, 0)); // let getCached settle

    expect(onCached).toHaveBeenCalledWith(['cached']); // fast paint happened
    expect(fetcher).toHaveBeenCalled(); // revalidation still in flight

    resolveFetch(['fresh']);
    const result = await pending;
    expect(result).toEqual({ data: ['fresh'], stale: false });
    expect(await getCached(KEY)).toEqual(['fresh']); // cache updated with fresh
  });

  it('failure with cache: resolves the cached data with stale: true', async () => {
    await setCached(KEY, ['cached']);
    const fetcher = jest.fn(async () => {
      throw new Error('network down');
    });

    const result = await cachedFetch<string[]>(KEY, fetcher);

    expect(result).toEqual({ data: ['cached'], stale: true });
    expect(warnSpy).toHaveBeenCalled(); // breadcrumb logged
    expect(await getCached(KEY)).toEqual(['cached']); // cache untouched
  });

  it('failure without cache: rethrows the fetcher error', async () => {
    const fetcher = jest.fn(async () => {
      throw new Error('network down');
    });

    await expect(cachedFetch(KEY, fetcher)).rejects.toThrow('network down');
  });

  it('failure with an expired cache entry: rethrows (expired = absent)', async () => {
    await writeRawEntry(KEY, {
      v: READ_CACHE_SCHEMA_VERSION,
      at: Date.now() - READ_CACHE_TTL_MS - 60_000,
      data: ['ancient'],
    });
    const fetcher = jest.fn(async () => {
      throw new Error('network down');
    });

    await expect(cachedFetch(KEY, fetcher)).rejects.toThrow('network down');
  });

  it('failure with a version-mismatched entry: rethrows (discarded = absent)', async () => {
    await writeRawEntry(KEY, {
      v: READ_CACHE_SCHEMA_VERSION + 1,
      at: Date.now(),
      data: ['old-shape'],
    });
    const fetcher = jest.fn(async () => {
      throw new Error('network down');
    });

    await expect(cachedFetch(KEY, fetcher)).rejects.toThrow('network down');
  });

  it('a null fetcher result removes the cached entry (no ghost content offline)', async () => {
    await setCached(KEY, { id: 'lesson-1' });
    const fetcher = jest.fn(async () => null);

    const result = await cachedFetch<{ id: string } | null>(KEY, fetcher);

    expect(result.data).toBeNull();
    // The stale copy must not survive a server-side deletion.
    expect(await getCached(KEY)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('a null fetcher result with no prior cache stores nothing', async () => {
    const fetcher = jest.fn(async () => null);

    await cachedFetch<{ id: string } | null>(KEY, fetcher);

    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});

describe('overflow to the filesystem', () => {
  it('stores a payload over the threshold in a file, not in AsyncStorage', async () => {
    const value = big();
    await setCached(KEY, value);

    const raw = await AsyncStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    const entry = JSON.parse(raw as string);
    expect(entry.data).toBeUndefined();
    expect(typeof entry.file).toBe('string');
    // The pointer is what Android's CursorWindow has to carry, so it is tiny.
    expect((raw as string).length).toBeLessThan(512);
    expect(mockFiles.size).toBe(1);

    expect(await getCached(KEY)).toEqual(value);
  });

  it('keeps a small payload inline and writes no file', async () => {
    await setCached(KEY, [1, 2, 3]);

    const entry = JSON.parse((await AsyncStorage.getItem(KEY)) as string);
    expect(entry.data).toEqual([1, 2, 3]);
    expect(entry.file).toBeUndefined();
    expect(mockFiles.size).toBe(0);
  });

  it('measures the threshold in UTF-8 bytes, not UTF-16 units', async () => {
    // Half the threshold in characters, three bytes each on the wire.
    await setCached(KEY, ['あ'.repeat(READ_CACHE_OVERFLOW_BYTES / 2)]);

    expect(mockFiles.size).toBe(1);
  });

  it('a rewrite that shrinks under the threshold removes the file', async () => {
    await setCached(KEY, big());
    expect(mockFiles.size).toBe(1);

    await setCached(KEY, ['small']);

    expect(mockFiles.size).toBe(0);
    expect(await getCached(KEY)).toEqual(['small']);
  });

  it('a rewrite that stays over the threshold reuses the one file', async () => {
    await setCached(KEY, big());
    await setCached(KEY, [...big(), 'more']);

    expect(mockFiles.size).toBe(1);
    expect(await getCached(KEY)).toHaveLength(2);
  });

  it('an entry whose file the OS reclaimed reads as a miss and is removed', async () => {
    await setCached(KEY, big());
    mockFiles.clear(); // the cache directory is reclaimable; act like it was

    expect(await getCached(KEY)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('an expired overflow entry removes its file too', async () => {
    await setCached(KEY, big());
    await writeRawEntry(KEY, {
      v: READ_CACHE_SCHEMA_VERSION,
      at: Date.now() - READ_CACHE_TTL_MS - 1,
      file: JSON.parse((await AsyncStorage.getItem(KEY)) as string).file,
    } as never);

    expect(await getCached(KEY)).toBeNull();
    expect(mockFiles.size).toBe(0);
  });

  it('removeCached drops the entry and its file', async () => {
    await setCached(KEY, big());

    await removeCached([KEY]);

    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(mockFiles.size).toBe(0);
  });

  it('two keys that sanitize alike get different files', async () => {
    const a = readCacheKey('book-content', 'id-1');
    const b = readCacheKey('book:content', 'id-1');
    await setCached(a, big());
    await setCached(b, big());

    expect(mockFiles.size).toBe(2);
  });
});

describe('pinned entries', () => {
  it('a pinned entry survives past the TTL; an unpinned one does not', async () => {
    await setCached(KEY, ['downloaded'], { pinned: true });
    const raw = JSON.parse((await AsyncStorage.getItem(KEY)) as string);
    await writeRawEntry(KEY, { ...raw, at: Date.now() - READ_CACHE_TTL_MS - 1 });

    expect(await getCached(KEY)).toEqual(['downloaded']);

    await writeRawEntry(KEY, {
      v: READ_CACHE_SCHEMA_VERSION,
      at: Date.now() - READ_CACHE_TTL_MS - 1,
      data: ['downloaded'],
    });
    expect(await getCached(KEY)).toBeNull();
  });

  it('pins an overflowed payload too', async () => {
    await setCached(KEY, big(), { pinned: true });
    const raw = JSON.parse((await AsyncStorage.getItem(KEY)) as string);
    expect(raw.pinned).toBe(true);
    await writeRawEntry(KEY, { ...raw, at: Date.now() - READ_CACHE_TTL_MS - 1 });

    expect(await getCached(KEY)).toEqual(big());
  });

  it('a rewrite without the flag unpins the entry', async () => {
    await setCached(KEY, ['downloaded'], { pinned: true });
    await setCached(KEY, ['ordinary']);

    const raw = JSON.parse((await AsyncStorage.getItem(KEY)) as string);
    expect(raw.pinned).toBeUndefined();
  });
});

describe('clearReadCache', () => {
  it('removes all read-cache entries and leaves other keys alone', async () => {
    await setCached(readCacheKey('courses', 'es'), [1]);
    await setCached(readCacheKey('review-queue', 'user-1'), [2]);
    await AsyncStorage.setItem('lesson-session:user-1:l-1', '{}');

    await clearReadCache();

    expect(await getCached(readCacheKey('courses', 'es'))).toBeNull();
    expect(await getCached(readCacheKey('review-queue', 'user-1'))).toBeNull();
    expect(await AsyncStorage.getItem('lesson-session:user-1:l-1')).toBe('{}');
  });

  it('with a userId, removes only that user\'s entries and keeps shared content', async () => {
    await setCached(readCacheKey('courses', 'es'), [1]);
    await setCached(readCacheKey('review-queue', 'user-1'), [2]);
    await setCached(readCacheKey('review-queue', 'user-12'), [3]);

    await clearReadCache('user-1');

    expect(await getCached(readCacheKey('courses', 'es'))).toEqual([1]); // shared kept
    expect(await getCached(readCacheKey('review-queue', 'user-1'))).toBeNull();
    // 'user-1' must not match 'user-12' as a substring
    expect(await getCached(readCacheKey('review-queue', 'user-12'))).toEqual([3]);
  });

  it('is a no-op when nothing matches', async () => {
    await expect(clearReadCache('nobody')).resolves.toBeUndefined();
  });

  it('removes overflow files as well as entries', async () => {
    await setCached(readCacheKey('book-content', 'b-1'), big());
    await setCached(readCacheKey('review-queue', 'user-1'), big());

    await clearReadCache('user-1');
    expect(mockFiles.size).toBe(1); // the shared book stays

    await clearReadCache();
    expect(mockFiles.size).toBe(0);
  });
});
