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
 * the meter communicates "how much talking time", and the tiers' live-tutor
 * ladder is what it tracks: 24 / 66 / 116 minutes a month
 * (`tutorMinutesPerMonth`). The old comment here said 10 / 20 / 30, which was
 * `dailyVoiceMinutes` from before migration 106 and matched nothing in
 * `lib/plans.ts` any more; the fills themselves were and are right, because
 * they only ever encoded the ORDER.
 */
export const METER_BLOCKS = 8;

export const CAPACITY: Record<Exclude<PlanId, 'starter'>, { fill: number; label: string }> = {
  basic: { fill: 3, label: 'DAILY CHECK-IN' },
  premium: { fill: 6, label: 'A FULL COMMUTE' },
  vip: { fill: 8, label: 'COMMUTE BOTH WAYS' },
};

/**
 * Number of lessons a generated goal track contains.
 *
 * Client-side mirror of `LESSONS_PER_TRACK` in
 * `supabase/functions/generate-goal-track/goal-core.ts`, which is the
 * authority — the generator rejects a plan of any other length. It cannot be
 * imported: that file is Deno, and `supabase/` is outside the app's tsconfig
 * and jest roots. Kept here rather than in a screen so the copy that quotes it
 * and the test that pins it read the same number.
 */
export const GOAL_TRACK_LESSONS = 6;

/**
 * What each rung of the ladder carries, cheapest first.
 *
 * TOTALS, NOT DELTAS — and that is a deliberate change. The previous strings
 * mixed the two ("Adds 25 messages" on a tier whose real cap is 50), which is
 * how they drifted out of agreement with `lib/plans.ts` without anyone
 * noticing: a delta is only checkable against two tiers at once, so nobody
 * checked. Stated as totals, each number here is one field of one plan and
 * `plan-pricing.test.ts` pins every one of them against `PLANS`. The ladder
 * still reads as an increase because the rungs sit on top of each other.
 *
 * Where each number comes from, for the next person changing `lib/plans.ts`:
 *   new words a day ....... PLANS[t].dailyNewCards
 *   messages .............. PLANS[t].dailyTextMessages
 *   tutor minutes a month . tutorMinutesPerMonth(t) — NOT dailyTutorMinutes,
 *                           which is the weaker ceiling and overstates the
 *                           feature roughly twentyfold (see lib/plans.ts).
 *   lessons offline ....... PLANS[t].offlineMode
 *   audiobook narration ... PLANS[t].audiobookNarration
 *   unlimited hints ....... isUnlimitedHints(PLANS[t].dailyHints)
 *
 * "Lessons and books offline" rather than "your plan offline": offline packs
 * warm course units, books and the day's news (`lib/offline-packs.ts`), and
 * the download control is mounted on `UnitPath`, the reader and the news
 * screen — not on the goal-track card. A generated plan is not downloadable
 * today, so saying so would be a claim the app does not honour.
 */
export const STEP_ADDS: Record<Exclude<PlanId, 'starter'>, string> = {
  basic: 'Your 6-lesson plan · 20 new words a day · 20 messages · 24 tutor minutes a month',
  premium: 'Unlimited new words · lessons and books offline · 50 messages · 66 tutor minutes a month',
  vip: 'Audiobook narration · unlimited hints · 75 messages · 116 tutor minutes a month',
};

/**
 * The three claims on the paywall's proof card, shown when the learner has an
 * ideal-self answer to build the ask around.
 *
 * Each one has to be true of the product as it ships today, which is the whole
 * reason they live here beside the numbers rather than inline in the screen:
 *
 *   1. Goal tracks are gated at basic and up — `ENTITLED_TIERS` in
 *      `supabase/functions/generate-goal-track/index.ts` — so "any paid plan"
 *      is exact, and the track is `GOAL_TRACK_LESSONS` lessons long.
 *   2. `ideal_l2_self` reaches text chat through `learnerContextIncludeFor`
 *      (ai-chat) and the live voice tutor through `include: ['goal', ...]`
 *      (tutor-session/start.ts). Both gate on `isEntitledToLearnerContext`,
 *      which is the same basic-and-up rule. So: every chat and every call.
 *   3. The free tier's real boundary, `PLANS.starter.dailyNewCards`.
 *
 * Stated as a plain data table so the copy is testable without rendering, the
 * same split as everything else in this file.
 */
export interface PlanProofRow {
  title: string;
  detail: string;
}

export const PLAN_PROOF: readonly PlanProofRow[] = [
  {
    title: 'Your 6-lesson plan',
    detail: 'Built from your moment. Opens on any paid plan.',
  },
  {
    title: 'Sol remembers your moment',
    detail: 'Every chat and call starts from it.',
  },
  {
    title: 'New words at your pace',
    detail: 'Free stops at 5 a day.',
  },
];

/**
 * The line under "Continue on the free plan".
 *
 * Declining has to be an informed choice (App Review 3.1.1, and DESIGN.md
 * §UX Psychology Principles §5: the dismiss stays neutral and every stated
 * loss is factually true). So this names what the free tier keeps — which is
 * most of the app — before naming the two things it does not.
 *
 * The "5" is `PLANS.starter.dailyNewCards` and is pinned by the tests.
 */
export const FREE_EXIT_LINE =
  'Free keeps lessons, reviews, reading and 5 new words a day. ' +
  'Your plan and Sol\u2019s memory need a paid plan.';

/**
 * Longest ideal-self answer the paywall headline will render.
 *
 * `ideal_l2_self` allows 300 characters (migration 028/035) and the headline
 * is set in the 30pt display face, so the full column would push the rungs and
 * the CTA off the first screen. 120 is the same gist-length the server already
 * takes for this field (`MAX_GOAL_CHARS` in
 * `supabase/functions/_shared/learner-context.ts`), so the sentence Sol works
 * from and the sentence the learner is shown are cut at the same place.
 */
export const MOMENT_MAX_CHARS = 120;

/**
 * The learner's onboarding "picture a moment" answer, ready to be a headline —
 * or null when there isn't one, in which case the caller keeps the generic
 * advertising line.
 *
 * Free text typed into a 300-character box, so it is sanitised rather than
 * trusted: every run of whitespace (newlines included) collapses to one space,
 * because a `\n` the learner typed would otherwise break the headline into
 * ragged blocks, and the result is cut to `MOMENT_MAX_CHARS`. The cut backs up
 * to the last space so it lands between words, and an actual truncation is
 * marked with an ellipsis rather than stopping mid-sentence as if that were
 * what they wrote.
 */
export function learnerMoment(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const flat = raw.replace(/\s+/g, ' ').trim();
  if (!flat) return null;
  if (flat.length <= MOMENT_MAX_CHARS) return flat;

  const cut = flat.slice(0, MOMENT_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  // Guard against a single unbroken 120-character "word" leaving a stub.
  const body = lastSpace > MOMENT_MAX_CHARS / 2 ? cut.slice(0, lastSpace) : cut;
  return `${body.replace(/[\s.,;:!?-]+$/, '')}\u2026`;
}

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
