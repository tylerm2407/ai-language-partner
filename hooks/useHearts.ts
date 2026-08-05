import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { spendHeart, syncHearts, type HeartsRow } from '../lib/supabase-queries';
import { computeHearts, spendHeartLocally, type HeartsState } from '../lib/hearts';
import { PLANS } from '../lib/plans';
import { useAdultMode } from './useAdultMode';
import type { SubscriptionTier } from '../types';

export function useHearts() {
  const { user } = useAuth();
  const { profile, subscription, setProfile } = useAppStore();
  const { heartsGateLessons } = useAdultMode();
  const [heartsState, setHeartsState] = useState<HeartsState>({ current: 5, max: 5, nextRegenAt: null });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Mirror of heartsState readable synchronously inside the spend chain
  // (avoids stale closures when spends are queued back to back).
  const heartsStateRef = useRef<HeartsState>(heartsState);
  // Serializes concurrent loseHeart calls so optimistic math never interleaves.
  const spendChainRef = useRef<Promise<void>>(Promise.resolve());

  const applyHeartsState = useCallback((state: HeartsState) => {
    heartsStateRef.current = state;
    setHeartsState(state);
  }, []);

  const tier = (subscription?.tier ?? 'starter') as SubscriptionTier;
  /** The subscription grants unlimited hearts. Drives "unlimited" messaging. */
  const isUnlimited = PLANS[tier]?.unlimitedHearts ?? false;
  /**
   * Hearts do not apply right now — either the plan grants unlimited, or the
   * learner is in adult mode, where hearts must never interrupt a lesson.
   * All gating below keys off this rather than `isUnlimited`, so the two
   * reasons stay distinguishable for messaging.
   */
  const heartsExempt = isUnlimited || !heartsGateLessons;

  // Compute hearts from profile
  useEffect(() => {
    if (!profile) return;
    if (heartsExempt) {
      applyHeartsState({ current: profile.maxHearts, max: profile.maxHearts, nextRegenAt: null });
      return;
    }
    const state = computeHearts(profile.hearts, profile.maxHearts, profile.lastHeartLostAt);
    applyHeartsState(state);
  }, [profile, heartsExempt, applyHeartsState]);

  // Adopt the server-authoritative hearts row into the profile + local state.
  const reconcileFromServer = useCallback((row: HeartsRow | null) => {
    if (!row) return;
    const freshProfile = useAppStore.getState().profile;
    if (freshProfile) {
      setProfile({ ...freshProfile, hearts: row.hearts, lastHeartLostAt: row.lastHeartLostAt });
    }
    applyHeartsState(computeHearts(row.hearts, row.maxHearts, row.lastHeartLostAt));
  }, [setProfile, applyHeartsState]);

  // Poll regen every 60s
  useEffect(() => {
    if (heartsExempt || !profile) return;

    intervalRef.current = setInterval(() => {
      const state = computeHearts(profile.hearts, profile.maxHearts, profile.lastHeartLostAt);
      applyHeartsState(state);
      // If hearts regenerated, sync with the server-authoritative state
      // (the RPC applies regen and returns the canonical values).
      if (state.current > profile.hearts && user) {
        syncHearts().then(reconcileFromServer).catch(console.error);
      }
    }, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [heartsExempt, profile, user, applyHeartsState, reconcileFromServer]);

  const canPlay = heartsExempt || heartsState.current > 0;

  const loseHeart = useCallback(async () => {
    if (!user || !profile || heartsExempt) return;
    // Chain onto any in-flight spend so optimistic math never interleaves.
    const task = spendChainRef.current.then(async () => {
      // Optimistic local update; the RPC is authoritative (applies pending
      // regen, decrements, and returns canonical state).
      const previous = heartsStateRef.current;
      applyHeartsState(spendHeartLocally(previous));
      try {
        const row = await spendHeart();
        // Reconcile from the RPC's returned authoritative values. A null row
        // (no profile) keeps the optimistic value; the 60s poll will settle it.
        reconcileFromServer(row);
      } catch (err) {
        console.error('Failed to spend heart in DB:', err);
        // Revert the optimistic decrement, then let the server settle truth.
        applyHeartsState(previous);
        syncHearts().then(reconcileFromServer).catch(console.error);
      }
    });
    // Keep the chain alive even if a link rejects unexpectedly.
    spendChainRef.current = task.catch(() => {});
    await task;
  }, [user, profile, heartsExempt, applyHeartsState, reconcileFromServer]);

  return { hearts: heartsState.current, maxHearts: heartsState.max, nextRegenAt: heartsState.nextRegenAt, isUnlimited, heartsExempt, canPlay, loseHeart };
}
