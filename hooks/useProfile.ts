import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { fetchProfile, upsertProfile } from '../lib/supabase-queries';
import type { UserProfile, LanguageCode, ProficiencyLevel } from '../types';

interface UseProfileReturn {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  updateProfile: (updates: {
    displayName?: string;
    nativeLanguage?: LanguageCode;
    targetLanguage?: LanguageCode;
    level?: ProficiencyLevel;
    dailyGoalMinutes?: number;
  }) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useProfile(): UseProfileReturn {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await fetchProfile(user.id);
      setProfile(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const updateProfile = useCallback(
    async (updates: Parameters<UseProfileReturn['updateProfile']>[0]) => {
      if (!user) return;

      try {
        setError(null);
        const updated = await upsertProfile(user.id, updates);
        setProfile(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update profile');
        throw e;
      }
    },
    [user]
  );

  return { profile, isLoading, error, updateProfile, refresh: loadProfile };
}
