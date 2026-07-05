import { useState, useEffect, useCallback } from 'react';
import { fetchUnitProgressTiles } from '../lib/supabase-queries';
import type { UnitProgressTile } from '../lib/supabase-queries';

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
    fetchUnitProgressTiles(userId, targetLanguage, limit)
      .then((data) => {
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
