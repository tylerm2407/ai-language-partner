/**
 * The trial-ending reminder — pure date math and copy.
 *
 * `lib/trial-timeline.ts` has promised this on the subscription screen since
 * the honest-paywall work ("We remind you the trial is ending, so nothing is
 * a surprise") while nothing in the app scheduled it. This module is the
 * missing half. It is deliberately free of React Native and expo imports so
 * the timing rules can be tested with a fake clock; `hooks/useNotifications.ts`
 * owns the actual scheduling.
 *
 * Source of truth for "am I in a trial" is the RevenueCat SDK on the device
 * (`CustomerInfo.entitlements.active[*].periodType === 'TRIAL'`), not the
 * `subscriptions` table: the webhook row carries no trial flag, and the whole
 * point of the reminder is to land before the store charges, which the SDK
 * knows to the second.
 *
 * Not a learner-configurable kind on purpose. The four kinds in
 * `lib/notification-prefs.ts` are habit nudges the learner opts into; this
 * one is a billing disclosure the paywall promised, so it is on whenever a
 * trial exists and notifications are permitted, and it fires exactly once.
 */
import { REMINDER_LEAD_DAYS } from './trial-timeline';

export const TRIAL_REMINDER_ID = 'trial-ending-reminder';

/** Local hour the reminder lands on. Late morning: awake, not at work yet for most. */
export const TRIAL_REMINDER_HOUR = 10;

/** Below this much runway a reminder is noise; the store's own receipt covers it. */
export const TRIAL_REMINDER_MIN_LEAD_MS = 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** What the reminder needs to know about the learner's trial, if any. */
export interface TrialState {
  /** True when an active entitlement is in its free-trial period. */
  isTrial: boolean;
  /** ISO timestamp the trial ends (the first charge). Null when unknown. */
  expiresAt: string | null;
}

export const NO_TRIAL: TrialState = { isTrial: false, expiresAt: null };

/** The subset of a RevenueCat entitlement this module reads. */
export interface TrialEntitlementLike {
  isActive: boolean;
  periodType: string;
  expirationDate: string | null;
}

/**
 * Derive the trial state from RevenueCat's active entitlements.
 *
 * Takes the entitlement objects rather than `CustomerInfo` so the pure module
 * needs no SDK type import. With several active entitlements in trial (not a
 * shape the store produces, but cheap to handle) the earliest expiry wins:
 * that is the first charge.
 */
export function trialStateFromEntitlements(
  entitlements: readonly TrialEntitlementLike[],
): TrialState {
  let earliest: number | null = null;
  for (const e of entitlements) {
    if (!e.isActive || e.periodType !== 'TRIAL' || !e.expirationDate) continue;
    const ms = Date.parse(e.expirationDate);
    if (!Number.isFinite(ms)) continue;
    if (earliest === null || ms < earliest) earliest = ms;
  }
  if (earliest === null) return NO_TRIAL;
  return { isTrial: true, expiresAt: new Date(earliest).toISOString() };
}

/**
 * When the reminder fires, or null when it should not.
 *
 * Target: `REMINDER_LEAD_DAYS` before expiry, at `TRIAL_REMINDER_HOUR` local —
 * the same lead the timeline on the subscription screen draws. If that moment
 * is already behind us (a trial shorter than the lead, or the app first opened
 * late in the trial) it moves to the next 10:00 that still precedes the
 * expiry, and failing that to one hour from now. Anything closer than
 * `TRIAL_REMINDER_MIN_LEAD_MS` to the charge is dropped: a reminder that
 * arrives with the receipt is not a reminder.
 */
export function trialReminderFireAt(
  expiresAt: string | null,
  now: Date = new Date(),
  leadDays: number = REMINDER_LEAD_DAYS,
): Date | null {
  if (!expiresAt) return null;
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) return null;
  const nowMs = now.getTime();
  if (expiryMs - nowMs < TRIAL_REMINDER_MIN_LEAD_MS) return null;

  const target = new Date(expiryMs - leadDays * DAY_MS);
  target.setHours(TRIAL_REMINDER_HOUR, 0, 0, 0);
  if (target.getTime() > nowMs) return target;

  // The ideal slot has passed. Try the next late morning, then fall back to
  // "soon", as long as either still leaves the learner an hour to act.
  const nextMorning = new Date(now);
  nextMorning.setHours(TRIAL_REMINDER_HOUR, 0, 0, 0);
  if (nextMorning.getTime() <= nowMs) nextMorning.setTime(nextMorning.getTime() + DAY_MS);
  if (expiryMs - nextMorning.getTime() >= TRIAL_REMINDER_MIN_LEAD_MS) return nextMorning;

  return new Date(nowMs + TRIAL_REMINDER_MIN_LEAD_MS);
}

/**
 * The notification's words. Factual and neutral: what happens, when, and the
 * one place to change it. No countdown language, no "don't lose", no price —
 * the store's confirmation sheet already showed the price, and quoting a
 * number we did not read from the store is the 3.1.2 mistake.
 */
export function trialReminderContent(
  expiresAt: string,
  now: Date = new Date(),
): { title: string; body: string } {
  const expiry = new Date(expiresAt);
  const dayMs = Math.round((startOfDay(expiry) - startOfDay(now)) / DAY_MS);
  const when =
    dayMs <= 0
      ? 'today'
      : dayMs === 1
        ? 'tomorrow'
        : `on ${expiry.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`;
  return {
    title: `Your free trial ends ${when}`,
    body:
      'Your plan renews then and full access continues. If you would rather stop, cancel before then in your App Store subscriptions.',
  };
}

function startOfDay(d: Date): number {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}
