import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './useAuth';
import { pruneExpiredLessonSessions } from '../lib/lesson-session-storage';

/**
 * Drop mid-lesson snapshots that have aged out of their one-day window.
 *
 * Redis expires its own copy; AsyncStorage does not. `loadLessonSession` only
 * cleans up a stale entry when the learner opens that same lesson again, so a
 * lesson started once and abandoned would leave a key on the device forever.
 * This sweeps them on mount and whenever the app returns to the foreground —
 * cheap (one getAllKeys plus a filtered read) and it only ever removes
 * entries that are already unusable.
 *
 * Unscoped on purpose: it sweeps every account's leftovers on this device,
 * not just the signed-in one, so a previous user's abandoned lessons don't
 * linger after they sign out.
 *
 * Mounted once in app/(app)/_layout.tsx, next to useOfflineQueueFlush.
 */
export function useLessonSessionSweep() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    const sweep = () => {
      pruneExpiredLessonSessions()
        .then((removed) => {
          if (removed > 0) {
            console.log(`[lesson-session] pruned ${removed} expired snapshot(s)`);
          }
        })
        .catch((err) => console.warn('[lesson-session] sweep failed:', err));
    };

    sweep();

    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') sweep();
    });
    return () => subscription.remove();
  }, [userId]);
}
