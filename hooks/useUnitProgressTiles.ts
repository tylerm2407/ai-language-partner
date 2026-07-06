import { useState, useEffect, useCallback } from 'react';
import { fetchUnitProgressTiles } from '../lib/supabase-queries';
import type { UnitProgressTile } from '../lib/supabase-queries';
import { cachedFetch, readCacheKey } from '../lib/read-cache';

export function useUnitProgressTiles(
  userId?: string,
  targetLanguage?: string,
  limit?: number,
) {
  const [tiles, setTiles] = useState<UnitProgressTile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId || !targetLanguage) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    // Stale-while-revalidate: cached tiles paint immediately; a fetch failure
    // with a cache resolves stale, so the error path only runs when there's
    // nothing to show. Limit is part of the key — a 4-tile entry must not be
    // served for an 8-tile request.
    cachedFetch<UnitProgressTile[]>(
      readCacheKey('unit-tiles', userId, targetLanguage, String(limit ?? 4)),
      () => fetchUnitProgressTiles(userId, targetLanguage, limit),
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
  }, [userId, targetLanguage, limit, reloadKey]);

  const refetch = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  return { tiles, loading, error, refetch };
}
