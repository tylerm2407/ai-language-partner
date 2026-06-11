import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { upsertProfile, addXp, updateStreak } from '../lib/supabase-queries';
import type { UserProfile } from '../types';

export function useProfile() {
  const { user } = useAuth();
  const { profile, setProfile, loading } = useAppStore();

  const updateProfile = useCallback(async (
    updates: Partial<Pick<UserProfile, 'displayName' | 'nativeLanguage' | 'targetLanguage' | 'level' | 'dailyGoalMinutes' | 'timezone'>>
  ) => {
    if (!user) return;
    const updated = await upsertProfile(user.id, updates);
    setProfile(updated);
    return updated;
  }, [user, setProfile]);

  const earnXp = useCallback(async (xp: number) => {
    if (!user || !profile) return;
    await addXp(user.id, xp);
    setProfile({ ...profile, totalXp: profile.totalXp + xp });
  }, [user, profile, setProfile]);

  /** Server-derived streak refresh (max +1/day, based on daily_stats activity). */
  const refreshStreak = useCallback(async () => {
    if (!user || !profile) return;
    const result = await updateStreak();
    if (result) {
      setProfile({ ...profile, streak: result.streak, longestStreak: result.longestStreak });
    }
  }, [user, profile, setProfile]);

  return { profile, loading, updateProfile, earnXp, refreshStreak };
}
