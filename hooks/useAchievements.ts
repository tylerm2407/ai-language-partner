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
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const newInSession = useRef(new Set<string>());

  // Bump the nonce to re-run the load effect below.
  const retry = useCallback(() => setReloadNonce((n) => n + 1), []);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const earned = await fetchAchievements(user.id);
        if (!cancelled) setEarnedAchievements(earned);
      } catch (err) {
        // Was awaited with no catch: a thrown rejection here left `loading`
        // true forever (a permanent spinner) and the grid's count stuck on
        // its loading em-dash. Surface it and let `retry` re-run this effect.
        console.error('[achievements] fetchAchievements failed:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your achievements.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, reloadNonce]);

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
    /** Non-null when the earned list could not be loaded. Render a retry. */
    error,
    retry,
    checkNewAchievements,
    isNewInSession,
  };
}
