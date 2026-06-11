import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { getXpProgress, getLeagueTier, type LeagueTier } from '../lib/levels';

interface LevelState {
  level: number;
  tier: LeagueTier;
  xpInLevel: number;
  xpToNextLevel: number;
  progress: number;
}

export function useLevel() {
  const { user } = useAuth();
  const { profile, setProfile } = useAppStore();
  const [levelState, setLevelState] = useState<LevelState>({
    level: 1, tier: 'bronze', xpInLevel: 0, xpToNextLevel: 100, progress: 0,
  });
  const [levelUpInfo, setLevelUpInfo] = useState<{ newLevel: number; newTier: LeagueTier; tierChanged: boolean } | null>(null);
  const prevLevelRef = useRef<number>(1);

  useEffect(() => {
    if (!profile) return;
    const { level, xpInLevel, xpToNextLevel, progress } = getXpProgress(profile.totalXp);
    const tier = getLeagueTier(level);
    setLevelState({ level, tier, xpInLevel, xpToNextLevel, progress });

    // Detect level-up
    if (prevLevelRef.current > 0 && level > prevLevelRef.current) {
      const prevTier = getLeagueTier(prevLevelRef.current);
      const tierChanged = tier !== prevTier;
      setLevelUpInfo({ newLevel: level, newTier: tier, tierChanged });

      // xp_level/league_tier are derived server-side by increment_xp
      // (migration 036) — only mirror the change into local state.
      if (user && (level !== profile.xpLevel || tier !== profile.leagueTier)) {
        setProfile({ ...profile, xpLevel: level, leagueTier: tier });
      }
    }
    prevLevelRef.current = level;
  }, [profile?.totalXp, user?.id, profile?.xpLevel, profile?.leagueTier]);

  const dismissLevelUp = useCallback(() => {
    setLevelUpInfo(null);
  }, []);

  return { ...levelState, levelUpInfo, dismissLevelUp };
}
