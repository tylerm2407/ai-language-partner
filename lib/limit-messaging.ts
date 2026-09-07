/**
 * What a learner is told when they hit a daily ceiling.
 *
 * Two audiences, two different messages, and conflating them is the mistake
 * this module exists to prevent:
 *
 *   - Below the top tier, a ceiling is a SALES MOMENT. The learner wanted
 *     more of the thing they are paying for, which is the best possible time
 *     to offer them more of it. They get an upgrade prompt.
 *
 *   - On the top tier there is nothing to sell. Showing "upgrade" to someone
 *     already on the most expensive plan reads as a bug at best and a
 *     bait-and-switch at worst. They get the honest version: what ran out and
 *     exactly when it comes back.
 *
 * Every ceiling in the app should route through here so the two cases cannot
 * drift apart per-feature.
 */

import { Alert } from 'react-native';

import { tutorMinutesPerMonth } from './plans';

/** The tier string as it appears on `subscriptions.tier`. */
export type Tier = 'starter' | 'basic' | 'premium' | 'vip';

/** The top tier — the one with nothing above it to upsell to. */
export const TOP_TIER: Tier = 'vip';

export interface LimitCopy {
  title: string;
  message: string;
  /** Present only when there is a higher tier to move to. */
  upgrade?: { label: string; route: string };
  /** Present only on the top tier: when the allowance returns. */
  resetsAt?: Date;
}

/**
 * When the daily counters roll over for this learner.
 *
 * Server-side every counter is keyed on `fluenci_user_today()`, which is the
 * learner's own local date — so the reset they should be told about is their
 * next local midnight, not UTC's. Computing it from the device clock gives
 * the same answer for the same reason.
 */
export function nextDailyReset(now: Date = new Date()): Date {
  const reset = new Date(now);
  reset.setHours(24, 0, 0, 0);
  return reset;
}

/** "in 3 hours" / "in 25 minutes" — a duration, because that is what the
 *  learner actually wants to know. An absolute time forces them to do the
 *  subtraction, and gets it wrong across a timezone change. */
export function describeReset(resetsAt: Date, now: Date = new Date()): string {
  const ms = resetsAt.getTime() - now.getTime();
  if (ms <= 0) return 'in a moment';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  return `in ${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * Build the message for a ceiling the learner just hit.
 *
 * `feature` is a plain-language noun phrase used mid-sentence — "messages",
 * "lesson audio", "writing feedback". Not a counter name: the learner never
 * agreed to know what `lesson_tts_plays` is.
 */
export function limitCopy(
  feature: string,
  tier: Tier | string | null | undefined,
  now: Date = new Date(),
): LimitCopy {
  const resetsAt = nextDailyReset(now);
  const when = describeReset(resetsAt, now);

  if (tier === TOP_TIER) {
    return {
      title: 'Daily limit reached',
      // No upsell, no apology, no vague "try again later". They are on the
      // top plan; the only useful information is when it comes back.
      message: `You've used all of today's ${feature}. Your allowance resets ${when}.`,
      resetsAt,
    };
  }

  return {
    title: 'Daily limit reached',
    message: `You've used all of today's ${feature}. Upgrade your plan for more, or wait — your allowance resets ${when}.`,
    upgrade: { label: 'See plans', route: '/(app)/profile/subscription' },
  };
}

/**
 * Show the ceiling message. One call per site, so no screen has to remember
 * the upsell-vs-top-tier rule for itself.
 *
 * `onUpgrade` is passed in rather than navigating here: this module has no
 * business knowing the router, and the caller already has one.
 */
export function showLimitAlert(
  feature: string,
  tier: Tier | string | null | undefined,
  onUpgrade?: () => void,
): void {
  const copy = limitCopy(feature, tier);
  if (copy.upgrade && onUpgrade) {
    Alert.alert(copy.title, copy.message, [
      { text: 'Not now', style: 'cancel' },
      { text: copy.upgrade.label, onPress: onUpgrade },
    ]);
    return;
  }
  // Top tier, or no navigation available: a single acknowledgement. Offering
  // "See plans" with nowhere to go would be worse than one button.
  Alert.alert(copy.title, copy.message);
}


// ─── The live tutor's two ceilings ───────────────────────────────────────
//
// The tutor is the only feature in the app metered on TWO clocks, and they
// come back at very different times: the daily one tonight, the monthly one
// possibly weeks from now. Telling a learner "your allowance resets in 3
// hours" when what they actually hit was the month is a lie they will act on.
// So the two get separate copy, keyed on the code the server already returns.
//
// MINUTES, NEVER MONEY. The server meters realtime audio in cents because
// that is what the vendor charges, and `lib/tutor-budget.ts` explains at
// length why none of that may reach the learner: a flat monthly price that
// visibly drains in currency is a taxi meter, and the cents figure is our cost
// rather than their price. `tutorMinutesPerMonth()` is the only sanctioned
// conversion, and it is the one used here.

/**
 * Every code `tutor-session` returns when it declines to open a call.
 *
 * Three, not two: `TUTOR_NOT_ENTITLED` is not a ceiling — nothing resets and
 * no time comes back — but it arrives through the same `TutorLimitError` that
 * the other two do, so a caller that catches one holds all three. Splitting
 * them across two functions would only push that switch into every screen.
 */
export type TutorLimitCode =
  | 'DAILY_TUTOR_LIMIT_REACHED'
  | 'MONTHLY_TUTOR_BUDGET_REACHED'
  | 'TUTOR_NOT_ENTITLED';

/**
 * The plain-language noun phrase for the live-tutor allowance, used mid-sentence.
 *
 * EXPORTED, and imported by `lib/tutor-budget.ts`, because this string appears
 * in two different messages a learner can see minutes apart: the in-call
 * "about four minutes of live tutor time left today" banner, and the
 * out-of-allowance copy afterwards. It used to be declared privately in both
 * files with a comment in each saying they matched on purpose — which is
 * intent documented in the one way that cannot enforce itself. A reword in one
 * place would have left the other silently drifted, and the same allowance
 * would have been called two different things in two consecutive screens.
 *
 * The direction is forced: `tutor-budget.ts` already imports this module, so
 * exporting from there instead would be a circular import.
 */
export const TUTOR_FEATURE_NOUN = 'live tutor time';

/**
 * When the monthly counter rolls over for this learner.
 *
 * Server-side the month is `fluenci_user_month()`, which resolves the
 * learner's LOCAL month — so the boundary is their next local 1st, computed
 * here from the device clock for the same reason `nextDailyReset` is.
 * `new Date(y, m + 1, 1)` rolls December into next January on its own.
 */
export function nextMonthlyReset(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * "1 October" — the DATE, not a duration and not "next month".
 *
 * A duration is right for the daily reset because it is hours away and the
 * learner is deciding whether to wait. A month away it is useless ("in 24
 * days" is not a thing anyone plans around), and "next month" is worse than
 * useless: `fluenci_user_month` resolves the learner's own local month, so for
 * someone at UTC+13 our next month and theirs are not the same day. Naming the
 * date is the only version that is true everywhere.
 *
 * Formatted from a fixed English month list rather than `toLocaleDateString`:
 * every string in this module is English, and a hand-rolled format is one that
 * behaves identically on a device with a trimmed ICU build and in a test.
 */
export function describeResetDate(resetsAt: Date): string {
  return `${resetsAt.getDate()} ${MONTH_NAMES[resetsAt.getMonth()]}`;
}

/**
 * What a learner is told when the live tutor refuses a call.
 *
 * Same two audiences as `limitCopy`, and the daily case simply IS `limitCopy`
 * — there is nothing special about the tutor's daily ceiling beyond its noun.
 * The monthly case is the one that needs its own copy, because it names a date
 * instead of a duration and because the number worth quoting is the plan's
 * monthly minutes rather than anything about today.
 *
 * `tier` is the EFFECTIVE tier — `effectiveTier(subscription, entitledTier)` —
 * so a learner whose school pays for vip is not upsold a plan they already
 * have. Passing `subscription.tier` here is the bug this note exists to stop.
 */
export function tutorLimitCopy(
  code: TutorLimitCode,
  tier: Tier | string | null | undefined,
  now: Date = new Date(),
): LimitCopy {
  if (code === 'DAILY_TUTOR_LIMIT_REACHED') {
    return limitCopy(TUTOR_FEATURE_NOUN, tier, now);
  }

  if (code === 'TUTOR_NOT_ENTITLED') {
    // No reset and no `resetsAt`, on either tier: this allowance does not come
    // back tonight or on the 1st, because the plan never had any. Saying "your
    // allowance resets in 3 hours" here would be a straightforward lie, and it
    // is the lie the generic daily copy would tell if this fell through to it.
    return {
      title: 'Part of a plan',
      message:
        tier === TOP_TIER
          ? `The live tutor is not available on your plan right now. Please get in touch if you think that is wrong.`
          : `The live tutor is part of a paid plan. Upgrade to talk to a tutor out loud.`,
      ...(tier === TOP_TIER
        ? {}
        : { upgrade: { label: 'See plans', route: '/(app)/profile/subscription' } }),
    };
  }

  const resetsAt = nextMonthlyReset(now);
  const when = describeResetDate(resetsAt);
  const minutes = tutorMinutesPerMonth(typeof tier === 'string' ? tier : 'starter');
  // An unknown tier resolves to starter, which has no tutor minutes at all.
  // Quoting "all 0 minutes" would be nonsense, so the amount is dropped and
  // the sentence still says the true thing.
  const amount = minutes > 0 ? `all ${minutes} minutes of ${TUTOR_FEATURE_NOUN}` : `your ${TUTOR_FEATURE_NOUN}`;

  if (tier === TOP_TIER) {
    return {
      title: 'Monthly limit reached',
      message: `You've used ${amount} this month. Your minutes come back on ${when}.`,
      resetsAt,
    };
  }

  return {
    title: 'Monthly limit reached',
    message: `You've used ${amount} this month. Upgrade your plan for more, or wait — your minutes come back on ${when}.`,
    upgrade: { label: 'See plans', route: '/(app)/profile/subscription' },
  };
}

/**
 * Show the tutor ceiling message. The counterpart to `showLimitAlert`, kept
 * separate only because the copy is chosen by code rather than by noun.
 */
export function showTutorLimitAlert(
  code: TutorLimitCode,
  tier: Tier | string | null | undefined,
  onUpgrade?: () => void,
): void {
  const copy = tutorLimitCopy(code, tier);
  if (copy.upgrade && onUpgrade) {
    Alert.alert(copy.title, copy.message, [
      { text: 'Not now', style: 'cancel' },
      { text: copy.upgrade.label, onPress: onUpgrade },
    ]);
    return;
  }
  Alert.alert(copy.title, copy.message);
}
