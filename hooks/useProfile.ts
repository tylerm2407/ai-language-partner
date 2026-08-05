import { useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { upsertProfile, incrementXpIdempotent, updateStreak } from '../lib/supabase-queries';
import { enqueue, isNetworkError, makeXpKey } from '../lib/offline-queue';
import type { UserProfile } from '../types';

// Module-level guard: the timezone sync runs at most once per user per app
// session, no matter how often the consuming screen remounts.
let timezoneSyncedForUser: string | null = null;

/**
 * One-shot sync of user_profiles.timezone to the device timezone.
 *
 * The server derives "today" for streaks / daily challenges / quotas from
 * this column (public.fluenci_user_today, migration 044), and the client
 * keys daily_stats / daily_challenges by the device-local date
 * (lib/dates.ts localToday) — so the profile column must track where the
 * device actually is. Skips silently when Intl is unavailable (retries
 * next session).
 */
export function useTimezoneSync() {
  const { user } = useAuth();
  const { profile, setProfile } = useAppStore();

  useEffect(() => {
    if (!user || !profile) return;
    if (timezoneSyncedForUser === user.id) return;

    let deviceTz: string | undefined;
    try {
      deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      deviceTz = undefined;
    }
    if (!deviceTz) return; // Intl unavailable — skip the sync entirely

    timezoneSyncedForUser = user.id;
    if (deviceTz === profile.timezone) return;

    upsertProfile(user.id, { timezone: deviceTz })
      .then((updated) => setProfile(updated))
      .catch((err) => console.warn('[tz-sync] failed to update profile timezone:', err));
  }, [user, profile, setProfile]);
}

export function useProfile() {
  const { user } = useAuth();
  const { profile, setProfile, loading } = useAppStore();

  const updateProfile = useCallback(async (
    updates: Partial<Pick<UserProfile, 'displayName' | 'nativeLanguage' | 'targetLanguage' | 'level' | 'dailyGoalMinutes' | 'timezone' | 'adultMode'>>
  ) => {
    if (!user) return;
    const updated = await upsertProfile(user.id, updates);
    setProfile(updated);
    return updated;
  }, [user, setProfile]);

  const earnXp = useCallback(async (xp: number) => {
    if (!user || !profile) return;
    // Idempotent award: the key is generated per call, so a replay of this
    // exact award (offline queue, lost-response retry) can never double-award.
    const key = makeXpKey('earn');
    try {
      await incrementXpIdempotent(xp, key);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Network blip: queue the award for replay on reconnect (same key)
      // and keep the local update below so the UI reflects the earned XP;
      // the server catches up when the queue flushes.
      await enqueue(user.id, { type: 'xp-award', payload: { amount: xp }, key });
    }
    setProfile({ ...profile, totalXp: profile.totalXp + xp });
  }, [user, profile, setProfile]);

  /** Server-derived streak refresh (max +1/day, based on daily_stats activity). */
  const refreshStreak = useCallback(async () => {
    if (!user || !profile) return;
    const result = await updateStreak();
    if (result) {
      setProfile({ ...profile, streak: result.streak, longestStreak: result.longestStreak });
    }
  }, [user, profile, setProfile]);

  return { profile, loading, updateProfile, earnXp, refreshStreak };
}
