/**
 * Onboarding checklist — pure logic.
 *
 * The checklist used to derive nothing and trust everything: a step was true
 * only if some screen had remembered to call `markItem` at the right moment,
 * and the "all done" state was guessed from a heuristic that was never
 * persisted. The result was a meter that disagreed with what the learner had
 * actually done and a rocket button that never went away.
 *
 * This module is the arbiter. Every derivation happens here, against observed
 * signals, and it is deliberately dumb: no I/O, no React, no clock except the
 * one the caller passes in.
 *
 * The one rule that matters: **reconciliation only ever ADDS ticks.** It is
 * not "derive the truth and overwrite" — it is "OR the truth in". That is
 * required rather than stylistic, because `app/(public)/onboarding.tsx` ticks
 * `firstLesson` for the pre-account trial lesson, which by construction leaves
 * no `lesson_completions` row behind. A derive-and-overwrite pass would look
 * at the empty table and un-tick work the learner genuinely did.
 */

import type { OnboardingChecklist, OnboardingStepKey } from '../types';

/** Display and iteration order for the persisted steps. */
export const ONBOARDING_STEP_KEYS: readonly OnboardingStepKey[] = [
  'chooseLanguage',
  'firstLesson',
  'aiConversation',
  'dailyReminder',
] as const;

/**
 * XP for finishing the checklist, and the idempotency key it is awarded under.
 *
 * The key is a fixed literal on purpose. The previous implementation went
 * through `earnXp`, which mints `xp:earn:${randomId()}` per call — a fresh key
 * every time, so `client_events`' `(user_id, event_key)` primary key de-duped
 * nothing and each app launch farmed another 50 XP. With a stable key the
 * server is the guard: a second award is impossible even if every client-side
 * flag write fails.
 *
 * Length matters — migration 046 rejects keys outside 8..128 characters.
 * `'onboarding-checklist:v1'` is 23. Bump the suffix only if the reward is
 * deliberately re-granted to everyone.
 */
export const ONBOARDING_COMPLETE_XP = 50;
export const ONBOARDING_COMPLETE_XP_KEY = 'onboarding-checklist:v1';

/**
 * Observed reality, one field per step.
 *
 * `null` means *unknown* — the read failed, or the question doesn't apply on
 * this platform. It is treated exactly like `false`, which is safe precisely
 * because reconciliation is OR-only: an offline launch where every signal
 * comes back `null` produces a checklist identical to the stored one, so
 * nothing is written and nothing is lost.
 */
export interface OnboardingSignals {
  hasTargetLanguage: boolean | null;
  hasCompletedLesson: boolean | null;
  hasAiConversation: boolean | null;
  notificationsGranted: boolean | null;
}

const SIGNAL_FOR_STEP: Record<OnboardingStepKey, keyof OnboardingSignals> = {
  chooseLanguage: 'hasTargetLanguage',
  firstLesson: 'hasCompletedLesson',
  aiConversation: 'hasAiConversation',
  dailyReminder: 'notificationsGranted',
};

/** True when the step needs nothing more from the learner. */
export function isStepResolved(
  checklist: OnboardingChecklist,
  key: OnboardingStepKey,
): boolean {
  return checklist[key] || checklist.skipped.includes(key);
}

/** Monotonic merge of observed signals into the stored checklist. Never un-ticks. */
export function reconcileSteps(
  stored: OnboardingChecklist,
  signals: OnboardingSignals,
): OnboardingChecklist {
  const next = { ...stored };
  for (const key of ONBOARDING_STEP_KEYS) {
    next[key] = stored[key] || signals[SIGNAL_FOR_STEP[key]] === true;
  }
  return next;
}

/** Every step done or skipped — the checklist has nothing left to ask for. */
export function isChecklistResolved(checklist: OnboardingChecklist): boolean {
  return ONBOARDING_STEP_KEYS.every((key) => isStepResolved(checklist, key));
}

/**
 * Stamp `completedAt` the first time the checklist resolves.
 *
 * Stamped once and never cleared: `completedAt` is the record of when the
 * learner got there, not a live mirror of the current state. (It cannot go
 * stale anyway — nothing un-ticks a step or un-skips one.)
 */
export function withCompletedAt(
  checklist: OnboardingChecklist,
  now: () => string,
): OnboardingChecklist {
  if (checklist.completedAt !== null) return checklist;
  if (!isChecklistResolved(checklist)) return checklist;
  return { ...checklist, completedAt: now() };
}

/**
 * Resolve a step by opting out of it.
 *
 * A step that is already done is left alone — being handed a "skip" for work
 * already finished is a caller bug, and recording it would make the row render
 * as skipped when it should render as done.
 */
export function withSkipped(
  checklist: OnboardingChecklist,
  key: OnboardingStepKey,
): OnboardingChecklist {
  if (checklist[key] || checklist.skipped.includes(key)) return checklist;
  return { ...checklist, skipped: [...checklist.skipped, key] };
}

/**
 * Field-by-field equality — the write-storm guard.
 *
 * Reconciliation runs on every launch, so the steady state has to be *zero*
 * writes rather than "one harmless write". `skipped` is compared as a set:
 * order carries no meaning and a re-ordered array must not look like a change.
 */
export function checklistEquals(
  a: OnboardingChecklist,
  b: OnboardingChecklist,
): boolean {
  if (
    a.chooseLanguage !== b.chooseLanguage ||
    a.firstLesson !== b.firstLesson ||
    a.aiConversation !== b.aiConversation ||
    a.dailyReminder !== b.dailyReminder ||
    a.dismissed !== b.dismissed ||
    a.completedAt !== b.completedAt ||
    a.celebratedAt !== b.celebratedAt
  ) {
    return false;
  }
  if (a.skipped.length !== b.skipped.length) return false;
  return a.skipped.every((key) => b.skipped.includes(key));
}

/**
 * Progress for the FAB ring.
 *
 * `grantedCount` is the number of display-only rows the checklist opens with
 * (account created). Goal gradient, DESIGN.md §UX Psychology Principles #2:
 * the meter never starts at zero, because work the learner already did should
 * be visible as done.
 */
export function checklistProgress(
  checklist: OnboardingChecklist,
  grantedCount: number,
): { resolved: number; total: number } {
  const done = ONBOARDING_STEP_KEYS.filter((key) =>
    isStepResolved(checklist, key),
  ).length;
  return {
    resolved: grantedCount + done,
    total: grantedCount + ONBOARDING_STEP_KEYS.length,
  };
}
