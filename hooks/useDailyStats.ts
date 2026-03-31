import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { upsertDailyStats } from '../lib/supabase-queries';
import type { DailyStats } from '../types';

export function useDailyStats() {
  const { user } = useAuth();
  const { dailyStats, setDailyStats, loading } = useAppStore();

  const addStats = useCallback(async (
    updates: Partial<Omit<DailyStats, 'id' | 'userId' | 'date'>>
  ) => {
    if (!user) return;
    const updated = await upsertDailyStats(user.id, updates);
    setDailyStats(updated);
    return updated;
  }, [user, setDailyStats]);

  return { dailyStats, loading, addStats };
}
