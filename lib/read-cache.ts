/**
 * Offline read cache (stale-while-revalidate) over AsyncStorage.
 *
 * Read hooks use `cachedFetch` so screens paint from cache instantly and
 * still show content when the network is down or flaky:
 *
 *   1. Read cache — if an entry exists, `onCached` fires immediately so the
 *      hook can set state and clear its loading flag (fast paint).
 *   2. The fetcher always runs. On success the cache is updated and the
 *      fresh data is resolved (`stale: false`).
 *   3. On fetcher failure: if a cached entry exists it is resolved with
 *      `stale: true` (and a breadcrumb is logged); otherwise the error is
 *      rethrown so the hook's existing error + retry path runs unchanged.
 *
 * Only server-owned *content* reads belong here (courses, units, lessons,
 * exercises, review queue, progress tiles). Never cache gamification values
 * (XP) — that is server-truth and owned elsewhere.
 *
 * Entries expire after READ_CACHE_TTL_MS (hard expiry — expired entries are
 * treated as absent and removed). Bump READ_CACHE_SCHEMA_VERSION whenever
 * cached payload shapes change to discard all old entries.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

// 2: the 'books-ranked' entry holds RankedBook[] (book + coverage shares)
//    rather than a bare ReadingBook[], so the 'For you' shelf can paint its
//    coverage line from cache instead of only after the refresh lands. A v1
//    entry would deserialize as an array of books with no `.book`, so every
//    v1 entry is discarded.
export const READ_CACHE_SCHEMA_VERSION = 2;
// 30 days, matching offline-pack retention (lib/offline-packs.ts): a pack the
// learner downloaded must not expire out from under them before the pack does.
export const READ_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const READ_CACHE_PREFIX = 'read-cache:';

/**
 * Payloads this size or larger are written to a file; the AsyncStorage entry
 * then holds only a pointer to it.
 *
 * Android keeps all of AsyncStorage in ONE SQLite database with a 6 MB default
 * ceiling (raised in android/gradle.properties), and every read crosses a
 * CursorWindow that throws "Row too big to fit into CursorWindow" for a single
 * row over ~2 MB. Production book content averages 386 KB, 5789 of 10375 books
 * are over 256 KB and 64 are over 2 MB — so on Android an inline book is not a
 * budget question, it is a failed read. iOS spills large values to files inside
 * AsyncStorage already; doing it here ourselves makes both platforms behave the
 * same and keeps the SQLite database small enough to stay fast.
 *
 * The files live under the cache directory, like offline-pack narration: the OS
 * may reclaim them under storage pressure, and a missing file reads back as a
 * cache miss, which is exactly what it is.
 */
export const READ_CACHE_OVERFLOW_BYTES = 256 * 1024;
const OVERFLOW_DIR_SEGMENTS = ['read-cache', `v${READ_CACHE_SCHEMA_VERSION}`];

interface CacheEntry<T> {
  /** Schema version — entries from other versions are discarded. */
  v: number;
  /** Epoch ms when the entry was written — the TTL reference. */
  at: number;
  /** The payload, for an entry stored inline. */
  data?: T;
  /** File name under the overflow directory, for a payload stored on disk. */
  file?: string;
  /**
   * Exempt from the TTL. Set for content an offline pack owns: the learner
   * asked for it and paid for it, so it stays until the pack is removed or
   * evicted (lib/offline-packs.ts), not until a cache clock runs out. Nothing
   * else should set it — an unpinned entry expiring is how stale content is
   * kept out of the app.
   */
  pinned?: boolean;
}

/** Build a namespaced cache key: readCacheKey('units', courseId) → 'read-cache:units:<id>'. */
export function readCacheKey(...parts: string[]): string {
  return READ_CACHE_PREFIX + parts.join(':');
}

function isValidEntry(value: unknown): value is CacheEntry<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.v !== 'number' || typeof v.at !== 'number') return false;
  return 'data' in v || typeof v.file === 'string';
}

/** UTF-8 length of a string. The overflow threshold is about bytes on disk. */
export function utf8Bytes(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code >= 0xd800 && code <= 0xdbff ? 4 : 3;
    if (code >= 0xd800 && code <= 0xdbff) i++;
  }
  return bytes;
}

function overflowDirectory(): Directory {
  return new Directory(Paths.cache, ...OVERFLOW_DIR_SEGMENTS);
}

/**
 * Filesystem-safe name for a key: deterministic, so rewriting a key replaces
 * its file instead of leaking one, and hashed, so two keys that sanitize to the
 * same string cannot land on the same file. Only the NAME is ever stored — the
 * absolute path is rebuilt from `Paths.cache` on every access, because the iOS
 * container directory changes between installs.
 */
function overflowName(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-64);
  return `${safe}.${hash.toString(16)}.json`;
}

function overflowFile(key: string): File {
  return new File(overflowDirectory(), overflowName(key));
}

function readOverflow(key: string): string | null {
  try {
    const file = overflowFile(key);
    return file.exists ? file.textSync() : null;
  } catch (err) {
    console.warn(`[read-cache] overflow read failed for "${key}":`, err);
    return null;
  }
}

function removeOverflowQuietly(key: string): void {
  try {
    const file = overflowFile(key);
    if (file.exists) file.delete();
  } catch {
    // Best-effort: a dead file costs disk, not correctness, and the cache
    // directory is reclaimable by the OS anyway.
  }
}

async function writeOverflow(key: string, payload: string, pinned: boolean): Promise<void> {
  try {
    const dir = overflowDirectory();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const file = overflowFile(key);
    file.create({ overwrite: true, intermediates: true });
    file.write(payload);
  } catch (err) {
    // Deliberately no inline fallback: a payload that reaches this path is the
    // size that breaks an Android read. A cache miss is the safe failure.
    console.warn(`[read-cache] overflow write failed for "${key}":`, err);
    await removeQuietly(key);
    return;
  }

  const entry: CacheEntry<never> = {
    v: READ_CACHE_SCHEMA_VERSION,
    at: Date.now(),
    file: overflowName(key),
    ...(pinned ? { pinned: true } : {}),
  };
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (err) {
    console.warn(`[read-cache] write failed for "${key}":`, err);
    removeOverflowQuietly(key);
  }
}

async function removeQuietly(key: string): Promise<void> {
  removeOverflowQuietly(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Best-effort cleanup — a failed removal only leaves a dead entry behind.
  }
}

/**
 * Read a cached value. Returns null (and removes the stored entry) when the
 * entry is missing, corrupt, from a different schema version, or older than
 * `ttlMs`. A cached literal `null` is indistinguishable from a miss — don't
 * rely on caching null payloads.
 */
export async function getCached<T>(
  key: string,
  ttlMs: number = READ_CACHE_TTL_MS,
): Promise<T | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch (err) {
    console.warn(`[read-cache] read failed for "${key}":`, err);
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await removeQuietly(key);
    return null;
  }

  if (
    !isValidEntry(parsed) ||
    parsed.v !== READ_CACHE_SCHEMA_VERSION ||
    (parsed.pinned !== true && Date.now() - parsed.at > ttlMs)
  ) {
    await removeQuietly(key);
    return null;
  }

  if (typeof parsed.file === 'string') {
    const payload = readOverflow(key);
    if (payload === null) {
      // The entry promises a file the cache directory no longer holds.
      await removeQuietly(key);
      return null;
    }
    try {
      return JSON.parse(payload) as T;
    } catch {
      await removeQuietly(key);
      return null;
    }
  }

  return parsed.data as T;
}

export interface SetCachedOptions {
  /** See CacheEntry.pinned — for offline packs only. */
  pinned?: boolean;
}

/** Write a value to the cache. Best-effort: write failures are logged, never thrown. */
export async function setCached<T>(
  key: string,
  data: T,
  opts: SetCachedOptions = {},
): Promise<void> {
  const pinned = opts.pinned === true;
  const payload = JSON.stringify(data);
  if (payload !== undefined && utf8Bytes(payload) >= READ_CACHE_OVERFLOW_BYTES) {
    await writeOverflow(key, payload, pinned);
    return;
  }

  // Small enough to store inline — and if this key used to be large, its file
  // has to go with the entry it belonged to.
  removeOverflowQuietly(key);
  const entry: CacheEntry<T> = {
    v: READ_CACHE_SCHEMA_VERSION,
    at: Date.now(),
    data,
    ...(pinned ? { pinned: true } : {}),
  };
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (err) {
    console.warn(`[read-cache] write failed for "${key}":`, err);
  }
}

/** Remove specific entries and any files they overflowed to. Best-effort. */
export async function removeCached(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  for (const key of keys) removeOverflowQuietly(key);
  try {
    await AsyncStorage.multiRemove(keys);
  } catch (err) {
    console.warn('[read-cache] removal failed:', err);
  }
}

export interface CachedFetchResult<T> {
  data: T;
  /** true when the network fetch failed and `data` was served from cache. */
  stale: boolean;
}

export interface CachedFetchOptions<T> {
  /** Hard-expiry TTL for the cached entry. Default READ_CACHE_TTL_MS (14 days). */
  ttlMs?: number;
  /**
   * Fired immediately when a cached entry exists, before the fetcher
   * resolves — set state and clear loading here for the fast paint.
   */
  onCached?: (cached: T) => void;
}

/**
 * Stale-while-revalidate fetch. See module doc for the exact semantics.
 * Rejects only when the fetcher fails AND no cached entry exists.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: CachedFetchOptions<T> = {},
): Promise<CachedFetchResult<T>> {
  const cached = await getCached<T>(key, opts.ttlMs);
  if (cached !== null && opts.onCached) {
    opts.onCached(cached);
  }

  try {
    const fresh = await fetcher();
    if (fresh != null) {
      await setCached(key, fresh);
    } else if (cached !== null) {
      // The server says this content no longer exists — remove the cached
      // copy so it can't be served as ghost content offline. (Storing the
      // null would ALSO destroy the entry, but silently: a stored null
      // reads back as a miss, see getCached.)
      await removeQuietly(key);
    }
    return { data: fresh, stale: false };
  } catch (err) {
    if (cached !== null) {
      console.warn(`[read-cache] fetch failed for "${key}" — serving cached data:`, err);
      return { data: cached, stale: true };
    }
    throw err;
  }
}

/**
 * Remove cached entries — call on sign-out. With no argument all read-cache
 * entries are removed. With a userId, only entries whose key contains that
 * user's id as a segment (e.g. review queue, progress tiles) are removed;
 * shared content entries (courses, units, lessons) are kept.
 */
export async function clearReadCache(userId?: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter(
    (key) =>
      key.startsWith(READ_CACHE_PREFIX) &&
      (userId === undefined || key.split(':').includes(userId)),
  );
  if (toRemove.length > 0) {
    await AsyncStorage.multiRemove(toRemove);
  }

  if (userId === undefined) {
    // Sign-out with no user to spare: drop the whole overflow directory, which
    // also sweeps files orphaned by a write that died between the two stores.
    try {
      const dir = overflowDirectory();
      if (dir.exists) dir.delete();
    } catch (err) {
      console.warn('[read-cache] overflow directory removal failed:', err);
    }
    return;
  }
  for (const key of toRemove) removeOverflowQuietly(key);
}
