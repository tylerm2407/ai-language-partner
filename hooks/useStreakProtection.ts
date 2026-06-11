import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { repairStreakWithFreeze, repairStreakWithShield } from '../lib/supabase-queries';
import { PLANS } from '../lib/plans';
import type { SubscriptionTier } from '../types';

export function useStreakProtection() {
  const { user } = useAuth();
  const { profile, subscription, setProfile } = useAppStore();
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [brokenStreak, setBrokenStreak] = useState(0);

  const tier = (subscription?.tier ?? 'starter') as SubscriptionTier;
  const hasShield = PLANS[tier]?.streakShield ?? false;
  const isRepairingRef = useRef(false);

  // Check for broken streak on load
  useEffect(() => {
    if (!profile || !user) return;
    if (isRepairingRef.current) return;

    // If streak is 0 but we have streak freezes or shield, user might have missed a day
    // This is a simplified check — in production you'd check last activity date
    if (profile.streak === 0 && profile.longestStreak > 0) {
      // Streak was already reset by the server, check if repairable
      if (hasShield && !profile.streakShieldUsedAt) {
        // Auto-apply shield for paid users — single atomic RPC (verifies the
        // plan server-side, restores the streak, logs the event).
        isRepairingRef.current = true;
        const today = new Date().toISOString().split('T')[0];
        (async () => {
          try {
            const result = await repairStreakWithShield();
            if (result) {
              setProfile({
                ...profile,
                streak: result.streak,
                longestStreak: result.longestStreak,
                streakShieldActive: true,
                streakShieldUsedAt: today,
              });
            }
          } catch (err) {
            console.error('Failed to auto-repair streak with shield:', err);
          } finally {
            isRepairingRef.current = false;
          }
        })();
      } else if (profile.streakFreezes > 0) {
        // Show repair modal for free users with freezes
        setBrokenStreak(profile.longestStreak);
        setShowRepairModal(true);
      }
    }
  }, [profile?.streak, user?.id]);

  const repairWithFreeze = useCallback(async () => {
    if (!user || !profile) return;
    try {
      // Single atomic RPC: consumes the freeze, restores the streak, logs
      // the event — no partial states on failure.
      const result = await repairStreakWithFreeze();
      if (result) {
        setProfile({
          ...profile,
          streak: result.streak,
          longestStreak: result.longestStreak,
          streakFreezes: result.streakFreezes,
        });
      }
      setShowRepairModal(false);
    } catch (err) {
      console.error('Failed to repair streak:', err);
    }
  }, [user, profile, setProfile]);

  const dismissRepair = useCallback(() => {
    setShowRepairModal(false);
  }, []);

  return {
    showRepairModal,
    brokenStreak,
    hasShield,
    freezesAvailable: profile?.streakFreezes ?? 0,
    repairWithFreeze,
    dismissRepair,
  };
}
