import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { consumeStreakFreeze, repairStreak, logStreakEvent, updateStreakShield } from '../lib/supabase-queries';
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
        // Auto-apply shield for paid users
        isRepairingRef.current = true;
        const today = new Date().toISOString().split('T')[0];
        (async () => {
          try {
            await repairStreak(user.id, profile.longestStreak, profile.longestStreak);
            await updateStreakShield(user.id, true, today);
            await logStreakEvent(user.id, 'shield_used', profile.longestStreak);
            setProfile({
              ...profile,
              streak: profile.longestStreak,
              streakShieldActive: true,
              streakShieldUsedAt: today,
            });
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
      await consumeStreakFreeze(user.id);
      await repairStreak(user.id, brokenStreak, profile.longestStreak);
      await logStreakEvent(user.id, 'freeze_used', brokenStreak);
      setProfile({
        ...profile,
        streak: brokenStreak,
        streakFreezes: profile.streakFreezes - 1,
      });
      setShowRepairModal(false);
    } catch (err) {
      console.error('Failed to repair streak:', err);
    }
  }, [user, profile, brokenStreak, setProfile]);

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
