/**
 * Per-day price presentation for the paywall (design 7c).
 *
 * Kept out of the component so the arithmetic is testable without rendering,
 * the same split as lib/trial-timeline.ts.
 *
 * Every figure derives from the real store price on the package — never from
 * PLANS[].priceMonthlyUsd. A displayed price that disagrees with what the
 * store charges is a 3.1.2 problem, and hardcoded USD is also wrong in every
 * other storefront.
 */
import type { PurchasesPackage } from 'react-native-purchases';
import { isAnnualPackage } from './purchases';
import type { PlanId } from './plans';

/** Days used to divide each term. 365 for a year; 30.4 = 365/12 for a month. */
export const DAYS_PER_YEAR = 365;
export const DAYS_PER_MONTH = 365 / 12;

/**
 * Daily equivalent of a package's price, formatted in the package's own
 * currency.
 *
 * `Intl.NumberFormat` is used rather than string surgery on `priceString`
 * because the daily figure is a NEW number — it has to be formatted from
 * scratch, in the currency the store quoted, with the store's own symbol
 * placement. `currencyCode` is present on every RevenueCat StoreProduct.
 */
export function perDayString(pkg: PurchasesPackage): string {
  const days = isAnnualPackage(pkg) ? DAYS_PER_YEAR : DAYS_PER_MONTH;
  const perDay = pkg.product.price / days;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: pkg.product.currencyCode,
      // Sub-unit precision matters here: at $0.55/day, rounding to whole
      // units renders "$1" and overstates the price by 80%.
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(perDay);
  } catch {
    // Intl currency data missing (older Android JSC) — fall back to the
    // store's own symbol from priceString, keeping the numeric part ours.
    const symbol = pkg.product.priceString.replace(/[\d.,\s]/g, '') || '$';
    return `${symbol}${perDay.toFixed(2)}`;
  }
}

/** Secondary line under the daily figure: the amount actually billed. */
export function billedLine(pkg: PurchasesPackage): string {
  return isAnnualPackage(pkg)
    ? `${pkg.product.priceString} billed yearly`
    : `${pkg.product.priceString} billed monthly`;
}

/**
 * Capacity meter fill, out of METER_BLOCKS, per tier. Not a computed ratio —
 * the meter communicates "how much talking time", and the tiers' voice-minute
 * ladder (10 / 20 / 30) is what it tracks.
 */
export const METER_BLOCKS = 8;

export const CAPACITY: Record<Exclude<PlanId, 'starter'>, { fill: number; label: string }> = {
  basic: { fill: 3, label: 'DAILY CHECK-IN' },
  premium: { fill: 6, label: 'A FULL COMMUTE' },
  vip: { fill: 8, label: 'COMMUTE BOTH WAYS' },
};

/**
 * What each rung adds over the rung below it. Basic is the entry tier now that
 * there is no free plan, so it states its allowance outright; the two above it
 * state the delta, because the whole point of the ladder is the increment.
 *
 * Mirrors PLAN_FEATURES in lib/plans.ts — if the limits there change, these
 * strings are wrong. Keep them in the same commit.
 */
export const STEP_ADDS: Record<Exclude<PlanId, 'starter'>, string> = {
  basic: '25 messages · 10 min voice · 3 grades a day · streak shield',
  premium: 'Adds 25 messages, 10 more voice minutes, offline mode',
  vip: 'Adds 25 messages, 10 more voice minutes, audiobook narration',
};

/** Ladder order, cheapest first — the rungs read upward. */
export const STEP_ORDER: Exclude<PlanId, 'starter'>[] = ['basic', 'premium', 'vip'];

/**
 * The real introductory offer on a package, or null when there isn't one.
 *
 * The 7c copy claims a free trial in two places (CTA and renewal line). That
 * claim is only true if the store actually carries a zero-price introductory
 * offer on this product, configured per-product in App Store Connect / Play
 * Console. A discounted-but-not-free intro is NOT a trial, so `price !== 0`
 * is rejected rather than described as free — saying "free" over a $2.99
 * intro is a 3.1.2 misrepresentation.
 *
 * When this returns null the caller must drop the trial language entirely,
 * which is what `ctaLabel` and `renewalLine` below do.
 */
export interface TrialOffer {
  /** Approximate length in days — for analytics and ordering, not display. */
  days: number;
  /** Display string in the offer's own units, e.g. "7 days", "1 week". */
  label: string;
}

const UNIT_DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

export function trialOffer(pkg: PurchasesPackage): TrialOffer | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;

  const unit = intro.periodUnit?.toUpperCase?.() ?? '';
  const perCycle = intro.periodNumberOfUnits;
  if (!UNIT_DAYS[unit] || !perCycle || perCycle < 1) return null;

  // `cycles` is how many billing periods the offer covers. Free trials are
  // almost always a single cycle, but multiplying is correct either way.
  const units = perCycle * Math.max(intro.cycles || 1, 1);
  const noun = unit.toLowerCase();
  return {
    days: units * UNIT_DAYS[unit],
    label: `${units} ${noun}${units === 1 ? '' : 's'}`,
  };
}

/** Display name for a tier, e.g. "VIP", "Premium". */
export function tierLabel(tier: Exclude<PlanId, 'starter'>): string {
  return tier === 'vip' ? 'VIP' : tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Primary CTA text. Mentions the trial only when one genuinely exists.
 */
export function ctaLabel(pkg: PurchasesPackage, tier: Exclude<PlanId, 'starter'>): string {
  const trial = trialOffer(pkg);
  return trial
    ? `Start ${trial.label} of ${tierLabel(tier)} free`
    : `Subscribe to ${tierLabel(tier)}`;
}

/**
 * Renewal disclosure under the CTA. App Review requires the billed amount and
 * the term in the binary; the trial clause appears only when real.
 */
export function renewalLine(pkg: PurchasesPackage): string {
  const term = isAnnualPackage(pkg) ? 'per year' : 'per month';
  const trial = trialOffer(pkg);
  return trial
    ? `${trial.label} free trial, then ${pkg.product.priceString} ${term}. Cancel anytime.`
    : `${pkg.product.priceString} ${term}. Cancel anytime.`;
}
