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
