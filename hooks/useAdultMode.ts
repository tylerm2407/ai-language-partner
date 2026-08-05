import { useMemo } from 'react';
import { useAppStore } from '../stores/useAppStore';
import {
  DEFAULT_GAMIFICATION_VISIBILITY,
  gamificationVisibility,
  type GamificationVisibility,
} from '../lib/adult-mode';

/**
 * What gamification the current learner should see.
 *
 * Reads the profile from the store rather than fetching, so it is cheap enough
 * to call from any surface. Before the profile loads we fall back to the full
 * gamified experience — showing a mechanic for a moment and then hiding it is
 * a smaller mistake than blanking the UI for everyone during load.
 */
export function useAdultMode(): GamificationVisibility {
  const profile = useAppStore((state) => state.profile);

  return useMemo(() => {
    if (!profile) return DEFAULT_GAMIFICATION_VISIBILITY;
    return gamificationVisibility(profile.adultMode);
  }, [profile]);
}
