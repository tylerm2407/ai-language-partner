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

  const setStreak = useCallback(async (streak: number, longestStreak: number) => {
    if (!user || !profile) return;
    await updateStreak(user.id, streak, longestStreak);
    setProfile({ ...profile, streak, longestStreak });
  }, [user, profile, setProfile]);

  return { profile, loading, updateProfile, earnXp, setStreak };
}
