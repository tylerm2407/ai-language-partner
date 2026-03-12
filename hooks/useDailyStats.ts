import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { fetchTodayStats, fetchStatsRange } from '../lib/supabase-queries';
import type { DailyStats } from '../types';

interface UseDailyStatsReturn {
  today: DailyStats | null;
  weekStats: DailyStats[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDailyStats(): UseDailyStatsReturn {
  const { user } = useAuth();
  const [today, setToday] = useState<DailyStats | null>(null);
  const [weekStats, setWeekStats] = useState<DailyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setToday(null);
      setWeekStats([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [todayData, weekData] = await Promise.all([
        fetchTodayStats(user.id),
        fetchStatsRange(
          user.id,
          weekAgo.toISOString().split('T')[0],
          now.toISOString().split('T')[0]
        ),
      ]);

      setToday(todayData);
      setWeekStats(weekData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { today, weekStats, isLoading, error, refresh: load };
}
