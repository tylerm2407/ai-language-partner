import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { updateHearts } from '../lib/supabase-queries';
import { computeHearts, type HeartsState } from '../lib/hearts';
import { PLANS } from '../lib/plans';
import type { SubscriptionTier } from '../types';

export function useHearts() {
  const { user } = useAuth();
  const { profile, subscription, setProfile } = useAppStore();
  const [heartsState, setHeartsState] = useState<HeartsState>({ current: 5, max: 5, nextRegenAt: null });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tier = (subscription?.tier ?? 'free') as SubscriptionTier;
  const isUnlimited = PLANS[tier]?.unlimitedHearts ?? false;

  // Compute hearts from profile
  useEffect(() => {
    if (!profile) return;
    if (isUnlimited) {
      setHeartsState({ current: profile.maxHearts, max: profile.maxHearts, nextRegenAt: null });
      return;
    }
    const state = computeHearts(profile.hearts, profile.maxHearts, profile.lastHeartLostAt);
    setHeartsState(state);
  }, [profile, isUnlimited]);

  // Poll regen every 60s
  useEffect(() => {
    if (isUnlimited || !profile) return;

    intervalRef.current = setInterval(() => {
      const state = computeHearts(profile.hearts, profile.maxHearts, profile.lastHeartLostAt);
      setHeartsState(state);
      // If hearts regenerated, update DB
      if (state.current > profile.hearts) {
        if (user) {
          updateHearts(user.id, state.current, state.current >= profile.maxHearts ? null : profile.lastHeartLostAt).catch(console.error);
          setProfile({ ...profile, hearts: state.current, lastHeartLostAt: state.current >= profile.maxHearts ? null : profile.lastHeartLostAt });
        }
      }
    }, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isUnlimited, profile, user, setProfile]);

  const canPlay = isUnlimited || heartsState.current > 0;

  const loseHeart = useCallback(async () => {
    if (!user || !profile || isUnlimited) return;
    const now = new Date().toISOString();
    const newHearts = Math.max(0, heartsState.current - 1);
    try {
      await updateHearts(user.id, newHearts, now);
    } catch (err) {
      console.warn('Failed to update hearts in DB:', err);
    }
    setProfile({ ...profile, hearts: newHearts, lastHeartLostAt: now });
    setHeartsState({ current: newHearts, max: profile.maxHearts, nextRegenAt: new Date(Date.now() + 4 * 60 * 60 * 1000) });
  }, [user, profile, isUnlimited, heartsState, setProfile]);

  return { hearts: heartsState.current, maxHearts: heartsState.max, nextRegenAt: heartsState.nextRegenAt, isUnlimited, canPlay, loseHeart };
}
