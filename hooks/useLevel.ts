import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import {
  getXpProgress,
  getLeagueTier,
  detectLevelUp,
  type LeagueTier,
  type LevelUpInfo,
} from '../lib/levels';

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
  const [levelUpInfo, setLevelUpInfo] = useState<LevelUpInfo | null>(null);

  /**
   * The last level this hook instance actually observed.
   *
   * `null`, not 1. Seeding it to 1 meant every mount compared the learner's
   * real level against "level 1" and concluded they had just levelled up — so
   * anyone past level 1 got a full-screen celebration over the first question
   * of every lesson, and dismissing it did nothing because the next mount
   * produced the same false positive. Starting from null makes the first
   * observation a baseline rather than a transition.
   */
  const prevLevelRef = useRef<number | null>(null);
  /**
   * Which account the baseline belongs to. Without this, signing out of a
   * level-40 account and into a new one carries the old baseline across, and
   * the new learner's genuine early level-ups are silently swallowed (each is
   * "below 40", so no transition is ever detected).
   */
  const baselineUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    const { level, xpInLevel, xpToNextLevel, progress } = getXpProgress(profile.totalXp);
    const tier = getLeagueTier(level);
    setLevelState({ level, tier, xpInLevel, xpToNextLevel, progress });

    const currentUserId = user?.id ?? null;
    if (baselineUserIdRef.current !== currentUserId) {
      // New account (or the first profile this instance has seen): take a
      // baseline and deliberately report nothing.
      baselineUserIdRef.current = currentUserId;
      prevLevelRef.current = level;
      return;
    }

    const levelUp = detectLevelUp(prevLevelRef.current, level);
    prevLevelRef.current = level;

    if (!levelUp) return;

    setLevelUpInfo(levelUp);

    // xp_level/league_tier are derived server-side by increment_xp
    // (migration 036) — only mirror the change into local state.
    if (user && (level !== profile.xpLevel || tier !== profile.leagueTier)) {
      setProfile({ ...profile, xpLevel: level, leagueTier: tier });
    }
  }, [profile?.totalXp, user?.id, profile?.xpLevel, profile?.leagueTier]);

  const dismissLevelUp = useCallback(() => {
    setLevelUpInfo(null);
  }, []);

  return { ...levelState, levelUpInfo, dismissLevelUp };
}
