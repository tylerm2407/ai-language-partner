import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import {
  fetchAchievements,
  checkAndAwardAchievements,
  type AchievementDefinition,
  type EarnedAchievement,
} from '../lib/achievements';

export function useAchievements() {
  const { user } = useAuth();
  const { profile, dailyStats } = useAppStore();
  const [earnedAchievements, setEarnedAchievements] = useState<EarnedAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const newInSession = useRef(new Set<string>());

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      const earned = await fetchAchievements(user.id);
      if (!cancelled) {
        setEarnedAchievements(earned);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const checkNewAchievements = useCallback(async (): Promise<AchievementDefinition[]> => {
    if (!user?.id || !profile) return [];

    const newlyEarned = await checkAndAwardAchievements(user.id, profile, dailyStats);

    if (newlyEarned.length > 0) {
      for (const a of newlyEarned) {
        newInSession.current.add(a.type);
      }
      // Refresh the full list
      const updated = await fetchAchievements(user.id);
      setEarnedAchievements(updated);
    }

    return newlyEarned;
  }, [user?.id, profile, dailyStats]);

  const isNewInSession = useCallback(
    (type: string): boolean => newInSession.current.has(type),
    []
  );

  return {
    earnedAchievements,
    loading,
    checkNewAchievements,
    isNewInSession,
  };
}
