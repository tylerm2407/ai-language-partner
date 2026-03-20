import { useState, useCallback } from 'react';
import { PERSONALITIES, PERSONALITY_LIST } from '../config/personalities';
import { useProfile } from './useProfile';
import { updateVoicePreference } from '../lib/supabase-queries';
import type { AIPersonality, AIPersonalityId } from '../types';

interface UsePersonalityReturn {
  currentPersonality: AIPersonality;
  personalities: AIPersonality[];
  setPersonality: (id: AIPersonalityId) => Promise<void>;
  isUpdating: boolean;
}

export function usePersonality(): UsePersonalityReturn {
  const { profile, refresh } = useProfile();
  const [isUpdating, setIsUpdating] = useState(false);

  const currentId: AIPersonalityId = profile?.voicePreference ?? 'sofia';
  const currentPersonality = PERSONALITIES[currentId] ?? PERSONALITIES.sofia;

  const setPersonality = useCallback(
    async (id: AIPersonalityId) => {
      if (!profile?.userId) return;

      try {
        setIsUpdating(true);
        await updateVoicePreference(profile.userId, id);
        await refresh();
      } catch {
        // Swallow — the UI can retry
      } finally {
        setIsUpdating(false);
      }
    },
    [profile?.userId, refresh]
  );

  return {
    currentPersonality,
    personalities: PERSONALITY_LIST,
    setPersonality,
    isUpdating,
  };
}
