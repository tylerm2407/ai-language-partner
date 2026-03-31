import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { updateLevel } from '../lib/supabase-queries';
import { getLevelFromXp, getXpProgress, getLeagueTier, type LeagueTier } from '../lib/levels';

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

      // Update DB
      if (user && (level !== profile.xpLevel || tier !== profile.leagueTier)) {
        updateLevel(user.id, level, tier).catch(console.error);
        setProfile({ ...profile, xpLevel: level, leagueTier: tier });
      }
    }
    prevLevelRef.current = level;
  }, [profile?.totalXp]);

  const dismissLevelUp = useCallback(() => {
    setLevelUpInfo(null);
  }, []);

  return { ...levelState, levelUpInfo, dismissLevelUp };
}
