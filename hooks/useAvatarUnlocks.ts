import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { useLevel } from './useLevel';
import { fetchAvatarAccessories, fetchUserUnlocks } from '../lib/supabase-queries';
import type { AvatarAccessory } from '../types';

export function useAvatarUnlocks() {
  const { user } = useAuth();
  const { profile } = useAppStore();
  const { level } = useLevel();
  const [accessories, setAccessories] = useState<AvatarAccessory[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [accs, unlocks] = await Promise.all([
        fetchAvatarAccessories(),
        fetchUserUnlocks(user.id),
      ]);
      setAccessories(accs);
      setUnlockedIds(unlocks);
    } catch (err) {
      console.error('Failed to load avatar unlocks:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, loadData]);

  // Check if an accessory is available (free or unlocked)
  const isUnlocked = useCallback(
    (accessory: AvatarAccessory): boolean => {
      if (accessory.unlockType === 'free') return true;
      return unlockedIds.includes(accessory.id);
    },
    [unlockedIds]
  );

  return { accessories, unlockedIds, isUnlocked, loading, refresh: loadData };
}
