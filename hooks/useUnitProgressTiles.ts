import { useState, useEffect, useCallback } from 'react';
import { fetchUnitProgressTiles } from '../lib/supabase-queries';
import type { UnitProgressTile } from '../lib/supabase-queries';
import { cachedFetch, readCacheKey } from '../lib/read-cache';

/**
 * The course id is its own key segment, so switching course is a different
 * cache entry rather than a stale one — nothing has to be invalidated when the
 * learner taps a pill. `clearReadCache(userId)` still matches on the user
 * segment. Limit is part of the key too: a 4-tile entry must not be served
 * for an 8-tile request.
 */
export function unitTilesCacheKey(userId: string, courseId: string, limit?: number): string {
  return readCacheKey('unit-tiles', userId, courseId, String(limit ?? 4));
}

/**
 * Home's "Continue learning" tiles for the learner's current course.
 *
 * `courseId` null is a real state, not a loading one: the learner has no
 * lesson path (an advanced learner with no C1 course yet, or an account the
 * placement hook has not healed yet). It resolves to an empty tile list with
 * no error, so Home renders its empty line instead of a spinner or a fault.
 */
export function useUnitProgressTiles(
  userId?: string,
  courseId?: string | null,
  limit?: number,
) {
  const [tiles, setTiles] = useState<UnitProgressTile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (!courseId) {
      setTiles([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    // Stale-while-revalidate: cached tiles paint immediately; a fetch failure
    // with a cache resolves stale, so the error path only runs when there's
    // nothing to show.
    cachedFetch<UnitProgressTile[]>(
      unitTilesCacheKey(userId, courseId, limit),
      () => fetchUnitProgressTiles(userId, courseId, limit),
      {
        onCached: (cached) => {
          if (cancelled) return;
          setTiles(cached);
          setLoading(false);
        },
      },
    )
      .then(({ data }) => {
        if (cancelled) return;
        setTiles(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setTiles(null);
        setError(err instanceof Error ? err.message : 'Failed to load lesson progress');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, courseId, limit, reloadKey]);

  const refetch = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  return { tiles, loading, error, refetch };
}
