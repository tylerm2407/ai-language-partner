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
 * (hearts / XP) — those are server-truth and owned elsewhere.
 *
 * Entries expire after READ_CACHE_TTL_MS (hard expiry — expired entries are
 * treated as absent and removed). Bump READ_CACHE_SCHEMA_VERSION whenever
 * cached payload shapes change to discard all old entries.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const READ_CACHE_SCHEMA_VERSION = 1;
export const READ_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const READ_CACHE_PREFIX = 'read-cache:';

interface CacheEntry<T> {
  /** Schema version — entries from other versions are discarded. */
  v: number;
  /** Epoch ms when the entry was written — the TTL reference. */
  at: number;
  data: T;
}

/** Build a namespaced cache key: readCacheKey('units', courseId) → 'read-cache:units:<id>'. */
export function readCacheKey(...parts: string[]): string {
  return READ_CACHE_PREFIX + parts.join(':');
}

function isValidEntry(value: unknown): value is CacheEntry<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.v === 'number' && typeof v.at === 'number' && 'data' in v;
}

async function removeQuietly(key: string): Promise<void> {
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
    Date.now() - parsed.at > ttlMs
  ) {
    await removeQuietly(key);
    return null;
  }

  return parsed.data as T;
}

/** Write a value to the cache. Best-effort: write failures are logged, never thrown. */
export async function setCached<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = { v: READ_CACHE_SCHEMA_VERSION, at: Date.now(), data };
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (err) {
    console.warn(`[read-cache] write failed for "${key}":`, err);
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
}
