/**
 * Give an unplaced account a lesson path.
 *
 * Mounted once in `app/(app)/_layout.tsx` beside `useOnboardingReconciliation`,
 * and shaped like it: once per user per app session, slot claimed before the
 * first await, optimistic store patch, Sentry on failure, nothing written in
 * the steady state.
 *
 * "Unplaced" (lib/course-placement.ts `placementState`) covers three things:
 * an account created before migration 125 that has no placement band at all;
 * a pointer the FK set to null when a course was deleted; and a pointer the
 * guard trigger cleared because the target language changed underneath it.
 * All three heal the same way — the course the declared level would open,
 * `start` choice, in the current language. A deliberate no-course placement
 * (advanced learner, no C1 course) is NOT unplaced and is left alone.
 */

import { useEffect } from 'react';
import * as Sentry from '@sentry/react-native';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { fetchCourses, upsertProfile } from '../lib/supabase-queries';
import { placementState, resolvePlacement } from '../lib/course-placement';
import { trackEvent } from '../lib/analytics';

/** Which user this session has already placed (or tried to). Module-level, like a store slot. */
let placedForUserId: string | null = null;

export function useEnsurePlacement() {
  const { user } = useAuth();
  // Selected as booleans so a profile patch that leaves both as-is does not
  // re-run the effect; the pass itself reads the live profile.
  const profileLoaded = useAppStore((s) => s.profile !== null);
  const hasPointer = useAppStore((s) => s.profile?.currentCourseId != null);
  const hasBand = useAppStore((s) => s.profile?.placementBand != null);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || !profileLoaded) return;
    // Cheap pre-check: a placed account never needs the course list.
    if (hasPointer) return;
    if (placedForUserId === userId) return;
    placedForUserId = userId;

    let cancelled = false;

    (async () => {
      const profile = useAppStore.getState().profile;
      if (!profile) return;
      let courses;
      try {
        courses = await fetchCourses(profile.targetLanguage);
      } catch (err) {
        // Offline or outage: leave the slot claimed so this does not spin, and
        // let the next launch try again. Home simply shows no tiles meanwhile.
        Sentry.captureException(err, { tags: { area: 'course-placement', op: 'ensure-fetch' } });
        return;
      }
      if (cancelled) return;

      const latest = useAppStore.getState().profile;
      if (!latest || placementState(latest, courses) !== 'unplaced') return;

      const placement = resolvePlacement(courses, latest.level, 'start');
      const previous = { currentCourseId: latest.currentCourseId, placementBand: latest.placementBand };
      useAppStore.getState().patchProfile(placement);
      try {
        await upsertProfile(userId, placement);
        trackEvent('course_placement_set', {
          screen: 'home',
          source: 'heal',
          band: placement.placementBand,
          language: latest.targetLanguage,
        });
      } catch (err) {
        // Restore only these two fields onto the LATEST profile.
        if (useAppStore.getState().profile) useAppStore.getState().patchProfile(previous);
        Sentry.captureException(err, { tags: { area: 'course-placement', op: 'ensure-write' } });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, profileLoaded, hasPointer, hasBand]);
}
