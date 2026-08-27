import { useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { upsertProfile, incrementXpIdempotent } from '../lib/supabase-queries';
import { enqueue, isNetworkError, makeXpKey } from '../lib/offline-queue';
import type { UserProfile } from '../types';

// Module-level guard: the timezone sync runs at most once per user per app
// session, no matter how often the consuming screen remounts.
let timezoneSyncedForUser: string | null = null;

/**
 * One-shot sync of user_profiles.timezone to the device timezone.
 *
 * The server derives "today" for daily challenges / quotas from
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

  /**
   * Award XP.
   *
   * `idempotencyKey` is what decides how often this award can ever be paid.
   * Pass a deterministic one (see `lessonXpKey`) when the award belongs to a
   * specific thing that must pay at most once; omit it for a genuinely
   * one-off award, which then gets a random key and is protected only against
   * a lost-response retry of that same call.
   */
  const earnXp = useCallback(async (xp: number, idempotencyKey?: string) => {
    if (!user || !profile) return;
    const key = idempotencyKey ?? makeXpKey('earn');
    try {
      const serverTotal = await incrementXpIdempotent(xp, key);
      // Prefer the server's total over adding locally. When this key has
      // already been paid — a replayed lesson — the server grants nothing and
      // returns the unchanged total, and adding `xp` here anyway would show
      // XP the learner does not have until the next cold load contradicts it.
      setProfile({
        ...profile,
        totalXp: serverTotal ?? profile.totalXp + xp,
      });
      return;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Network blip: queue the award for replay on reconnect (same key)
      // and keep the local update below so the UI reflects the earned XP;
      // the server catches up when the queue flushes.
      await enqueue(user.id, { type: 'xp-award', payload: { amount: xp }, key });
    }
    setProfile({ ...profile, totalXp: profile.totalXp + xp });
  }, [user, profile, setProfile]);

  return { profile, loading, updateProfile, earnXp };
}
