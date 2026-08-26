/**
 * Reconcile the stored onboarding checklist against what the learner actually did.
 *
 * Mounted once in `app/(app)/_layout.tsx` beside the other app-session
 * housekeeping hooks — deliberately NOT in the FAB, which only exists on Home.
 * A learner who finished their first lesson and then never opened Home would
 * otherwise never have that recorded.
 *
 * Runs once per user per app session and, in the steady state, writes nothing:
 * `checklistEquals` short-circuits before the network call. The whole pass is
 * free of extra latency too — both server-side signals ride along in
 * `loadUserData`'s existing `Promise.all`.
 *
 * Offline behaviour falls out of the design rather than being special-cased:
 * every signal degrades to `null`, `reconcileSteps` is OR-only, so `next`
 * equals `stored` and no write is attempted. This deliberately does not route
 * through `lib/offline-queue.ts` — the checklist is a whole-blob column, and a
 * queued blob replayed days later would clobber newer state to reinstate a
 * value that costs nothing to recompute on the next launch.
 */

import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { updateOnboardingChecklist } from '../lib/supabase-queries';
import {
  checklistEquals,
  isChecklistResolved,
  reconcileSteps,
  withCompletedAt,
  type OnboardingSignals,
} from '../lib/onboarding-checklist';

export function useOnboardingReconciliation() {
  const { user } = useAuth();
  const profileLoaded = useAppStore((s) => s.profile !== null);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || !profileLoaded) return;

    // `reconciledUserId` is READ here, never selected. Subscribing to it would
    // make claiming the slot below re-run this effect, and the cleanup of the
    // first run would cancel the pass it just started — the whole thing would
    // reliably abort halfway.
    if (useAppStore.getState().reconciledUserId === userId) return;

    // Claim the session slot *before* awaiting anything. Two mounts in the
    // same tick (a remount, a dev-mode double effect) would otherwise both see
    // an unclaimed slot and both write. A failed pass simply retries next
    // launch, which is the right trade for a value this cheap to recompute.
    useAppStore.getState().setReconciled(userId);

    let cancelled = false;

    (async () => {
      const notificationsGranted = await Notifications.getPermissionsAsync()
        .then((res) => res.status === 'granted')
        .catch(() => null);
      if (cancelled) return;

      // Read the store live rather than closing over a render-time snapshot:
      // the permission prompt above can take an arbitrarily long time, and
      // anything the learner did meanwhile (an XP award, a checklist tick)
      // must not be reverted by writing back a stale profile.
      const { profile, hasCompletedLessonSignal, hasAiConversationSignal, setProfile } =
        useAppStore.getState();
      if (!profile) return;

      const stored = profile.onboardingChecklist;
      const signals: OnboardingSignals = {
        // A profile with no target language cannot reach this layout, so the
        // absence of one means "not loaded yet", not "not chosen".
        hasTargetLanguage: profile.targetLanguage ? true : null,
        hasCompletedLesson: hasCompletedLessonSignal,
        hasAiConversation: hasAiConversationSignal,
        notificationsGranted,
      };

      let next = withCompletedAt(reconcileSteps(stored, signals), () =>
        new Date().toISOString(),
      );

      // Silent resolve. If reconciliation is what pushed the checklist over
      // the line, everything it ticked is historical — work the learner did
      // before this build could observe it. Congratulating them for it with
      // confetti and 50 XP would be celebrating a database read, so the
      // checklist is marked acknowledged and retires without a sound.
      //
      // The guard is `!isChecklistResolved(stored)`: a checklist the learner
      // finished in-app this session is already resolved on entry, so it falls
      // through to the FAB and gets its celebration.
      if (!isChecklistResolved(stored) && isChecklistResolved(next)) {
        next = { ...next, celebratedAt: next.completedAt, dismissed: true };
      }

      if (checklistEquals(stored, next)) return;

      setProfile({ ...profile, onboardingChecklist: next });
      try {
        await updateOnboardingChecklist(userId, next);
      } catch (err) {
        // Restore only the checklist field, onto the LATEST profile — writing
        // back the whole snapshot would undo unrelated XP or streak updates
        // that landed while this was in flight.
        const latest = useAppStore.getState().profile;
        if (latest) {
          useAppStore.getState().setProfile({ ...latest, onboardingChecklist: stored });
        }
        Sentry.captureException(err, {
          tags: { area: 'onboarding-checklist', op: 'reconcile' },
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, profileLoaded]);
}
