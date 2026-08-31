import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { upsertProfile, incrementXpIdempotent } from '../lib/supabase-queries';
import { enqueue, isNetworkError, makeXpKey } from '../lib/offline-queue';
import type { UserProfile } from '../types';

/**
 * Which (user, timezone) pair has been written this session.
 *
 * Keyed on the RESOLVED TIMEZONE as well as the user, not just the user. The
 * old guard was the user id alone, set BEFORE the write was known to have
 * succeeded — so a failed write marked the sync done and it never retried, and
 * a learner who travelled kept the timezone they signed up in for the rest of
 * the session.
 */
let timezoneSyncedFor: string | null = null;

/** Let the next check run again — used when the app returns to the foreground. */
function invalidateTimezoneSync(): void {
  timezoneSyncedFor = null;
}

/**
 * Keep user_profiles.timezone tracking the device.
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
  const { profile, setProfile, patchProfile } = useAppStore();

  // Re-check when the app comes back to the foreground. A learner who flies
  // somewhere does not relaunch the app on landing, and every server-side
  // "today" — quotas, daily challenges, the new-card cap — is derived from this
  // column.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') invalidateTimezoneSync();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!user || !profile) return;

    let deviceTz: string | undefined;
    try {
      deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      deviceTz = undefined;
    }
    if (!deviceTz) return; // Intl unavailable — skip the sync entirely

    const attempt = `${user.id}:${deviceTz}`;
    if (timezoneSyncedFor === attempt) return;

    // Already correct on the server — nothing to write, and it counts as synced.
    if (deviceTz === profile.timezone) {
      timezoneSyncedFor = attempt;
      return;
    }

    upsertProfile(user.id, { timezone: deviceTz })
      .then((updated) => {
        // Marked ONLY on success. Setting this up front meant one failed write
        // disabled the sync for the whole session.
        timezoneSyncedFor = attempt;
        setProfile(updated);
      })
      .catch((err) => console.warn('[tz-sync] failed to update profile timezone:', err));
  }, [user, profile, setProfile]);
}

export function useProfile() {
  const { user } = useAuth();
  const { profile, setProfile, patchProfile, loading } = useAppStore();

  const updateProfile = useCallback(async (
    updates: Partial<Pick<UserProfile, 'displayName' | 'nativeLanguage' | 'targetLanguage' | 'level' | 'dailyGoalMinutes' | 'timezone'>>
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
      // patchProfile, not a spread of the render-time `profile`: a heart or
      // avatar write landing in the same tick would otherwise be clobbered by
      // this stale snapshot and visibly revert.
      patchProfile({ totalXp: serverTotal ?? profile.totalXp + xp });
      return;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Network blip: queue the award for replay on reconnect (same key)
      // and keep the local update below so the UI reflects the earned XP;
      // the server catches up when the queue flushes.
      await enqueue(user.id, { type: 'xp-award', payload: { amount: xp }, key });
    }
    patchProfile({ totalXp: profile.totalXp + xp });
  }, [user, profile, setProfile]);

  return { profile, loading, updateProfile, earnXp };
}
