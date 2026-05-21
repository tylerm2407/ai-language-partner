import { useState, useEffect } from 'react';
import { fetchUnitProgressTiles } from '../lib/supabase-queries';
import type { UnitProgressTile } from '../lib/supabase-queries';

export function useUnitProgressTiles(
  userId?: string,
  targetLanguage?: string,
  limit?: number,
) {
  const [tiles, setTiles] = useState<UnitProgressTile[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !targetLanguage) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchUnitProgressTiles(userId, targetLanguage, limit)
      .then((data) => {
        setTiles(data);
        setLoading(false);
      })
      .catch(() => {
        setTiles(null);
        setLoading(false);
      });
  }, [userId, targetLanguage, limit]);

  return { tiles, loading };
}
