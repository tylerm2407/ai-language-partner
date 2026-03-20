import { useState, useEffect, useCallback } from 'react';
import { fetchOrCreateTutorProfile } from '../lib/supabase-queries';
import {
  calculateCEFR,
  shouldLevelUp,
  shouldLevelDown,
  recordSessionResult,
} from '../lib/adaptive';
import type { CEFRLevel, TutorProfile, LanguageCode } from '../types';

interface UseAdaptiveDifficultyReturn {
  cefrLevel: CEFRLevel;
  profile: TutorProfile | null;
  isLoading: boolean;
  shouldLevelUp: boolean;
  shouldLevelDown: boolean;
  recordSession: (errorRate: number, newVocab: string[]) => Promise<void>;
}

export function useAdaptiveDifficulty(
  userId: string | undefined,
  language: LanguageCode
): UseAdaptiveDifficultyReturn {
  const [profile, setProfile] = useState<TutorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await fetchOrCreateTutorProfile(userId, language);
      setProfile(data);
    } catch (e) {
      // Non-critical — adaptive difficulty is a nice-to-have
    } finally {
      setIsLoading(false);
    }
  }, [userId, language]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const cefrLevel: CEFRLevel = profile ? calculateCEFR(profile) : 'A1';
  const levelUpRecommended = profile ? shouldLevelUp(profile) : false;
  const levelDownRecommended = profile ? shouldLevelDown(profile) : false;

  const recordSession = useCallback(
    async (errorRate: number, newVocab: string[]) => {
      if (!userId) return;

      const { profile: updated } = await recordSessionResult(
        userId,
        language,
        errorRate,
        newVocab
      );
      setProfile(updated);
    },
    [userId, language]
  );

  return {
    cefrLevel,
    profile,
    isLoading,
    shouldLevelUp: levelUpRecommended,
    shouldLevelDown: levelDownRecommended,
    recordSession,
  };
}
