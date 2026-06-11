import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { spendHeart, syncHearts } from '../lib/supabase-queries';
import { computeHearts, type HeartsState } from '../lib/hearts';
import { PLANS } from '../lib/plans';
import type { SubscriptionTier } from '../types';

export function useHearts() {
  const { user } = useAuth();
  const { profile, subscription, setProfile } = useAppStore();
  const [heartsState, setHeartsState] = useState<HeartsState>({ current: 5, max: 5, nextRegenAt: null });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tier = (subscription?.tier ?? 'starter') as SubscriptionTier;
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
      // If hearts regenerated, sync with the server-authoritative state
      // (the RPC applies regen and returns the canonical values).
      if (state.current > profile.hearts && user) {
        syncHearts()
          .then((row) => {
            if (!row) return;
            const freshProfile = useAppStore.getState().profile;
            if (freshProfile) {
              setProfile({ ...freshProfile, hearts: row.hearts, lastHeartLostAt: row.lastHeartLostAt });
            }
            setHeartsState(computeHearts(row.hearts, row.maxHearts, row.lastHeartLostAt));
          })
          .catch(console.error);
      }
    }, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isUnlimited, profile, user, setProfile]);

  const canPlay = isUnlimited || heartsState.current > 0;

  const loseHeart = useCallback(async () => {
    if (!user || !profile || isUnlimited) return;
    // Optimistic local update; the RPC is authoritative (applies pending
    // regen, decrements, and returns canonical state).
    const optimistic = Math.max(0, heartsState.current - 1);
    setHeartsState({ current: optimistic, max: profile.maxHearts, nextRegenAt: new Date(Date.now() + 4 * 60 * 60 * 1000) });
    try {
      const row = await spendHeart();
      if (row) {
        const freshProfile = useAppStore.getState().profile;
        if (freshProfile) {
          setProfile({ ...freshProfile, hearts: row.hearts, lastHeartLostAt: row.lastHeartLostAt });
        }
        setHeartsState(computeHearts(row.hearts, row.maxHearts, row.lastHeartLostAt));
      }
    } catch (err) {
      console.warn('Failed to spend heart in DB:', err);
    }
  }, [user, profile, isUnlimited, heartsState, setProfile]);

  return { hearts: heartsState.current, maxHearts: heartsState.max, nextRegenAt: heartsState.nextRegenAt, isUnlimited, canPlay, loseHeart };
}
