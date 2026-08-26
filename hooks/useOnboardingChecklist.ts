import { useCallback, useMemo } from 'react';
import * as Sentry from '@sentry/react-native';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { updateOnboardingChecklist } from '../lib/supabase-queries';
import {
  ONBOARDING_STEP_KEYS,
  checklistEquals,
  checklistProgress,
  isChecklistResolved,
  withCompletedAt,
  withSkipped,
} from '../lib/onboarding-checklist';
import type { OnboardingChecklist, OnboardingStepKey } from '../types';

export type OnboardingRowState = 'done' | 'todo' | 'skipped';

export interface OnboardingRow {
  key: string;
  label: string;
  icon: string;
  route: string | null;
  state: OnboardingRowState;
  /** Rows without a step key are display-only and carry no persisted state. */
  stepKey: OnboardingStepKey | null;
}

/**
 * Goal gradient (DESIGN.md §UX Psychology Principles #2): the checklist never
 * starts at zero. Work the learner has genuinely already done is listed and
 * pre-checked, so the meter opens with real momentum rather than an empty bar.
 * These are display-only — they carry no persisted state.
 */
const GRANTED_ITEMS: { key: string; label: string; icon: string }[] = [
  { key: 'accountCreated', label: 'Create your account', icon: 'person-add-outline' },
];

const STEP_ITEMS: { key: OnboardingStepKey; label: string; icon: string; route: string | null }[] = [
  // `chooseLanguage` has no route and is already true for anyone who can reach
  // Home — onboarding writes it before the account exists. It is listed for
  // the same goal-gradient reason as the granted rows above, and the FAB never
  // makes it tappable.
  { key: 'chooseLanguage', label: 'Choose your language', icon: 'globe-outline', route: null },
  { key: 'firstLesson', label: 'Finish your first lesson', icon: 'book-outline', route: '/learn' },
  { key: 'aiConversation', label: 'Try AI conversation', icon: 'chatbubbles-outline', route: '/chat' },
  // Not "Set daily reminder" — the app schedules a streak-save reminder at a
  // time it picks, so the old label promised a control that doesn't exist.
  { key: 'dailyReminder', label: 'Turn on practice reminders', icon: 'notifications-outline', route: null },
];

/**
 * The onboarding checklist, as the UI sees it.
 *
 * Three copies of this hook are mounted at once (Home, the lesson screen, the
 * chat screen), which is what made the previous implementation lossy: every
 * mutator closed over the `profile` captured at its own render, so a `markItem`
 * from the lesson screen rebuilt the whole checklist from a snapshot that
 * predated the chat screen's write, and the failure path did
 * `setProfile(profile)` with that same stale snapshot — reverting unrelated XP
 * and streak updates along with it.
 *
 * The fix is that `mutate` reads `useAppStore.getState()` at call time and, on
 * failure, restores only the checklist field onto whatever profile is current.
 * Its dependency list is `[user]`, which also removes the second mechanism that
 * was cancelling the FAB's celebration timers on every profile write.
 */
export function useOnboardingChecklist() {
  const { user } = useAuth();
  const checklist = useAppStore((s) => s.profile?.onboardingChecklist ?? null);

  const ready = checklist !== null;

  /**
   * Apply a pure transform to the live checklist and persist it.
   *
   * Re-throws so callers can decide: the FAB's celebration must not mark
   * itself celebrated if the write failed, while a fire-and-forget `markItem`
   * from a lesson screen is happy to `.catch(console.error)` — reconciliation
   * will pick the tick up on the next launch either way.
   */
  const mutate = useCallback(
    async (transform: (current: OnboardingChecklist) => OnboardingChecklist) => {
      if (!user) return;
      const { profile, setProfile } = useAppStore.getState();
      if (!profile) return;

      const current = profile.onboardingChecklist;
      const next = withCompletedAt(transform(current), () => new Date().toISOString());
      if (checklistEquals(current, next)) return;

      setProfile({ ...profile, onboardingChecklist: next });
      try {
        await updateOnboardingChecklist(user.id, next);
      } catch (err) {
        const latest = useAppStore.getState().profile;
        if (latest) {
          useAppStore.getState().setProfile({ ...latest, onboardingChecklist: current });
        }
        Sentry.captureException(err, { tags: { area: 'onboarding-checklist' } });
        throw err;
      }
    },
    [user],
  );

  const markItem = useCallback(
    (key: OnboardingStepKey) => mutate((c) => (c[key] ? c : { ...c, [key]: true })),
    [mutate],
  );

  const skipItem = useCallback(
    (key: OnboardingStepKey) => mutate((c) => withSkipped(c, key)),
    [mutate],
  );

  /** Acknowledge the completion — confetti shown, XP awarded, retire the FAB. */
  const markCelebrated = useCallback(
    () =>
      mutate((c) =>
        c.celebratedAt !== null
          ? c
          : { ...c, celebratedAt: new Date().toISOString(), dismissed: true },
      ),
    [mutate],
  );

  const dismiss = useCallback(
    () => mutate((c) => (c.dismissed ? c : { ...c, dismissed: true })),
    [mutate],
  );

  const isResolved = checklist !== null && isChecklistResolved(checklist);

  /**
   * No timers and no heuristics. `celebratedAt` is the belt to `dismissed`'s
   * braces: even if the dismiss write is lost, a celebrated checklist never
   * comes back.
   */
  const isVisible = ready && !checklist.dismissed && checklist.celebratedAt === null;

  /**
   * There is a completion the learner has not been shown yet.
   *
   * `!dismissed` is part of the condition, not an oversight: someone who tapped
   * Hide asked for this thing to go away, and ambushing them with confetti when
   * the last step happens to tick is not a reward. The XP is only ever paid
   * alongside the celebration, so it is not owed either.
   */
  const celebrationPending =
    ready &&
    !checklist.dismissed &&
    checklist.completedAt !== null &&
    checklist.celebratedAt === null;

  const { resolved: completedCount, total: totalCount } = useMemo(
    () =>
      checklist
        ? checklistProgress(checklist, GRANTED_ITEMS.length)
        : { resolved: 0, total: GRANTED_ITEMS.length + ONBOARDING_STEP_KEYS.length },
    [checklist],
  );

  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  const items = useMemo<OnboardingRow[]>(
    () => [
      ...GRANTED_ITEMS.map((item) => ({
        ...item,
        route: null,
        state: 'done' as const,
        stepKey: null,
      })),
      ...STEP_ITEMS.map((item) => ({
        ...item,
        stepKey: item.key,
        state: !checklist
          ? ('todo' as const)
          : checklist[item.key]
            ? ('done' as const)
            : checklist.skipped.includes(item.key)
              ? ('skipped' as const)
              : ('todo' as const),
      })),
    ],
    [checklist],
  );

  return {
    ready,
    isVisible,
    items,
    checklist,
    completedCount,
    totalCount,
    progress,
    isResolved,
    celebrationPending,
    markItem,
    skipItem,
    markCelebrated,
    dismiss,
  };
}
