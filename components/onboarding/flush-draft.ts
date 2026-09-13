/**
 * Turn the local onboarding draft into the learner's real profile.
 *
 * Shared by the post-sign-up flush and by the already-authenticated path (an
 * existing account whose onboarding never finished). Everything server-side
 * lands in ONE call — `applyOnboardingDraft`, migration 127 — so the profile,
 * course pointer, avatar preset, checklist and onboarding_completed are
 * written together or not at all, and a retry after a dropped connection can
 * simply run this again.
 */
import { DEFAULT_DAILY_GOAL_MINUTES } from '../../lib/active-time';
import { trackEvent } from '../../lib/analytics';
import { normalizePlacementChoice, resolvePlacement } from '../../lib/course-placement';
import {
  DEFAULT_NOTIFICATION_PREFS,
  saveNotificationPrefs,
} from '../../lib/notification-prefs';
import { clearPendingOnboarding, type PendingOnboardingDraft } from '../../lib/pending-onboarding';
import { applyOnboardingDraft, fetchCourses } from '../../lib/supabase-queries';
import { DEFAULT_LANGUAGE, DEFAULT_LEVEL } from './steps/config';

export async function flushDraftToProfile(draft: PendingOnboardingDraft): Promise<void> {
  const draftLanguage = draft.targetLanguage ?? DEFAULT_LANGUAGE;
  const draftLevel = draft.level ?? DEFAULT_LEVEL;
  // The course id could not be resolved before sign-in (curriculum tables
  // are RLS `TO authenticated`), so the draft carries only the CHOICE and
  // it is turned into a course here, now that there is a session. A fetch
  // failure throws like any other step and lands in the caller's retry path.
  // `lib/course-placement.ts` stays the one source of truth for how a level
  // and a choice become a course; the server guard (migration 125) still
  // rejects a pointer that does not belong to the row's language.
  const choice = normalizePlacementChoice(draftLevel, draft.courseChoice);
  const placement = resolvePlacement(await fetchCourses(draftLanguage), draftLevel, choice);

  // `firstLesson` is ticked when the trial ran: it happened before this
  // account existed, so nothing server-side recorded it, and re-asking the
  // learner to "complete your first lesson" would deny work they just did.
  await applyOnboardingDraft({
    targetLanguage: draftLanguage,
    level: draftLevel,
    dailyGoalMinutes: draft.dailyGoalMinutes ?? DEFAULT_DAILY_GOAL_MINUTES,
    idealL2Self: draft.idealL2Self,
    displayName: draft.displayName,
    avatarPresetId: draft.avatarPresetId,
    currentCourseId: placement.currentCourseId,
    placementBand: placement.placementBand,
    firstLesson: !!draft.trial,
  });
  trackEvent('course_placement_set', {
    screen: 'onboarding',
    source: choice,
    band: placement.placementBand,
    language: draftLanguage,
  });

  // The reminders the learner chose, moved from the draft to their real
  // home on the device. They are local-only preferences — nothing here is
  // scheduled and no permission is requested; `hooks/useNotifications.ts`
  // reads them once the OS prompt has been answered.
  //
  // Logged and swallowed: a failed AsyncStorage write costs the learner their
  // reminder times, while a throw would cost them the whole profile write and
  // strand them back in onboarding. The defaults they would fall back to are
  // the ones the step opened on, so the loss is small and recoverable in
  // Settings.
  await saveNotificationPrefs(draft.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS).catch(
    (err) => console.error('[onboarding] notification prefs write failed:', err),
  );

  await clearPendingOnboarding();
}
