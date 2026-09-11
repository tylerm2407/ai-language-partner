/**
 * Unit tests for lib/plan-pricing.ts — the paywall's arithmetic and its
 * trial claims.
 *
 * The per-day figure is the number the whole 7c design leans on, and it is
 * derived, not quoted: a rounding slip here misprices the product on the one
 * screen where Apple 3.1.2 cares most. The trial helpers exist because the
 * copy must never promise a free trial the store does not actually carry.
 */
import {
  perDayString,
  billedLine,
  trialOffer,
  ctaLabel,
  renewalLine,
  tierLabel,
  DAYS_PER_MONTH,
  DAYS_PER_YEAR,
  CAPACITY,
  METER_BLOCKS,
  STEP_ORDER,
  STEP_ADDS,
  PLAN_PROOF,
  FREE_EXIT_LINE,
  GOAL_TRACK_LESSONS,
  MOMENT_MAX_CHARS,
  learnerMoment,
} from './plan-pricing';
import { PLANS, tutorMinutesPerMonth, isUnlimitedNewCards, isUnlimitedHints } from './plans';
import type { PurchasesPackage } from 'react-native-purchases';

// Same treatment as lib/purchases.test.ts: these helpers are pure functions
// over a store product, so the native SDK is irrelevant and mocking it keeps
// the module importable under jest.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {},
  LOG_LEVEL: { WARN: 1 },
}));

/** Minimal package stub — only the fields these helpers read. */
function pkg(opts: {
  price: number;
  priceString: string;
  currencyCode?: string;
  identifier?: string;
  packageType?: string;
  intro?: {
    price: number;
    periodUnit: string;
    periodNumberOfUnits: number;
    cycles?: number;
  } | null;
}): PurchasesPackage {
  return {
    packageType: opts.packageType ?? 'CUSTOM',
    product: {
      identifier: opts.identifier ?? 'fluenci_premium_monthly',
      price: opts.price,
      priceString: opts.priceString,
      currencyCode: opts.currencyCode ?? 'USD',
      introPrice: opts.intro
        ? {
            price: opts.intro.price,
            priceString: opts.intro.price === 0 ? 'Free' : '$1.99',
            cycles: opts.intro.cycles ?? 1,
            period: 'P1W',
            periodUnit: opts.intro.periodUnit,
            periodNumberOfUnits: opts.intro.periodNumberOfUnits,
          }
        : null,
    },
  } as unknown as PurchasesPackage;
}

const annual = (price: number, priceString: string, extra = {}) =>
  pkg({ price, priceString, packageType: 'ANNUAL', ...extra });
const monthly = (price: number, priceString: string, extra = {}) =>
  pkg({ price, priceString, packageType: 'MONTHLY', ...extra });

describe('perDayString', () => {
  it('divides an annual price by 365', () => {
    // $199.90 / 365 = $0.5476… -> $0.55
    expect(perDayString(annual(199.9, '$199.90'))).toBe('$0.55');
  });

  it('divides a monthly price by 365/12', () => {
    // $19.99 / 30.4167 = $0.6572… -> $0.66
    expect(perDayString(monthly(19.99, '$19.99'))).toBe('$0.66');
  });

  it('covers the rest of the current US ladder', () => {
    expect(perDayString(monthly(9.99, '$9.99'))).toBe('$0.33');
    expect(perDayString(monthly(29.99, '$29.99'))).toBe('$0.99');
    expect(perDayString(annual(99.9, '$99.90'))).toBe('$0.27');
    expect(perDayString(annual(299.9, '$299.90'))).toBe('$0.82');
  });

  it('always keeps two decimals, never rounding to whole units', () => {
    // The failure this guards: $0.55/day rendering as "$1" overstates by 80%.
    const out = perDayString(annual(199.9, '$199.90'));
    expect(out).toMatch(/\d\.\d{2}$/);
  });

  it('formats in the package currency, not a hardcoded dollar sign', () => {
    const eur = annual(199.9, '199,90 €', { currencyCode: 'EUR' });
    const out = perDayString(eur);
    expect(out).toContain('€');
    expect(out).not.toContain('$');
  });

  it('falls back to the priceString symbol when Intl currency data is missing', () => {
    const spy = jest
      .spyOn(Intl, 'NumberFormat')
      .mockImplementation(() => {
        throw new Error('no currency data');
      });
    try {
      // Numeric part stays ours; the symbol is recovered from priceString.
      expect(perDayString(annual(199.9, '£199.90'))).toBe('£0.55');
    } finally {
      spy.mockRestore();
    }
  });

  it('uses the documented day divisors', () => {
    expect(DAYS_PER_YEAR).toBe(365);
    expect(DAYS_PER_MONTH).toBeCloseTo(30.4167, 3);
  });
});

describe('billedLine', () => {
  it('names the real billed amount and term', () => {
    expect(billedLine(annual(199.9, '$199.90'))).toBe('$199.90 billed yearly');
    expect(billedLine(monthly(19.99, '$19.99'))).toBe('$19.99 billed monthly');
  });
});

describe('trialOffer', () => {
  it('reads a real 7-day free trial', () => {
    const p = monthly(19.99, '$19.99', {
      intro: { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7 },
    });
    expect(trialOffer(p)).toEqual({ days: 7, label: '7 days' });
  });

  it('singularises a one-week trial in its own units', () => {
    const p = monthly(19.99, '$19.99', {
      intro: { price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1 },
    });
    expect(trialOffer(p)).toEqual({ days: 7, label: '1 week' });
  });

  it('multiplies across cycles', () => {
    const p = monthly(19.99, '$19.99', {
      intro: { price: 0, periodUnit: 'MONTH', periodNumberOfUnits: 1, cycles: 3 },
    });
    expect(trialOffer(p)).toEqual({ days: 90, label: '3 months' });
  });

  it('returns null when there is no introductory offer at all', () => {
    expect(trialOffer(monthly(19.99, '$19.99'))).toBeNull();
  });

  it('refuses to call a discounted intro a free trial', () => {
    // A $1.99 intro is an offer, not a trial. Describing it as free is the
    // 3.1.2 misrepresentation this guard exists to prevent.
    const p = monthly(19.99, '$19.99', {
      intro: { price: 1.99, periodUnit: 'MONTH', periodNumberOfUnits: 1 },
    });
    expect(trialOffer(p)).toBeNull();
  });

  it('rejects a malformed period rather than inventing one', () => {
    const p = monthly(19.99, '$19.99', {
      intro: { price: 0, periodUnit: 'FORTNIGHT', periodNumberOfUnits: 1 },
    });
    expect(trialOffer(p)).toBeNull();
  });
});

describe('ctaLabel / renewalLine', () => {
  const withTrial = {
    intro: { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7 },
  };

  it('promises the trial only when one exists', () => {
    expect(ctaLabel(monthly(19.99, '$19.99', withTrial), 'premium')).toBe(
      'Start 7 days of Premium free',
    );
    expect(ctaLabel(monthly(19.99, '$19.99'), 'premium')).toBe('Subscribe to Premium');
  });

  it('drops the trial clause from the renewal line when there is no trial', () => {
    expect(renewalLine(annual(199.9, '$199.90', withTrial))).toBe(
      '7 days free trial, then $199.90 per year. Cancel anytime.',
    );
    expect(renewalLine(annual(199.9, '$199.90'))).toBe(
      '$199.90 per year. Cancel anytime.',
    );
  });

  it('always discloses the billed amount and term', () => {
    for (const p of [annual(199.9, '$199.90'), monthly(19.99, '$19.99', withTrial)]) {
      const line = renewalLine(p);
      expect(line).toContain(p.product.priceString);
      expect(line).toMatch(/per (year|month)/);
      expect(line).toContain('Cancel anytime.');
    }
  });

  it('capitalises tier names, keeping VIP an initialism', () => {
    expect(tierLabel('basic')).toBe('Basic');
    expect(tierLabel('premium')).toBe('Premium');
    expect(tierLabel('vip')).toBe('VIP');
  });
});

describe('capacity meter', () => {
  it('fills within the meter and rises with the tier', () => {
    for (const tier of STEP_ORDER) {
      expect(CAPACITY[tier].fill).toBeGreaterThan(0);
      expect(CAPACITY[tier].fill).toBeLessThanOrEqual(METER_BLOCKS);
    }
    expect(CAPACITY.basic.fill).toBeLessThan(CAPACITY.premium.fill);
    expect(CAPACITY.premium.fill).toBeLessThan(CAPACITY.vip.fill);
  });

  it('reads cheapest-first', () => {
    expect(STEP_ORDER).toEqual(['basic', 'premium', 'vip']);
  });
});

/**
 * The anti-drift test the previous strings needed and did not have.
 *
 * `STEP_ADDS` is marketing copy quoting hard limits, and it had been wrong
 * since migration 106: it advertised 25 basic messages after the real cap was
 * cut to 20, so the upgrade prompt fired five messages after the API had
 * already begun refusing. A comment saying "keep these in sync" is what failed.
 * This is the check that cannot be skipped.
 *
 * The last case is the one that earns its keep: it pulls EVERY integer out of
 * each string and refuses any number that is not a real limit of that plan, so
 * a new claim carrying an invented figure fails without anyone remembering to
 * add a case for it.
 */
describe('STEP_ADDS agrees with lib/plans.ts', () => {
  it('quotes basic’s real caps', () => {
    expect(PLANS.basic.dailyNewCards).toBe(20);
    expect(PLANS.basic.dailyTextMessages).toBe(20);
    expect(STEP_ADDS.basic).toContain(`${PLANS.basic.dailyNewCards} new words a day`);
    expect(STEP_ADDS.basic).toContain(`${PLANS.basic.dailyTextMessages} messages`);
    expect(STEP_ADDS.basic).toContain(`${tutorMinutesPerMonth('basic')} tutor minutes a month`);
    expect(STEP_ADDS.basic).toContain(`Your ${GOAL_TRACK_LESSONS}-lesson plan`);
  });

  it('quotes premium’s real caps, and calls its new-word cap unlimited only if it is', () => {
    expect(isUnlimitedNewCards(PLANS.premium.dailyNewCards)).toBe(true);
    expect(STEP_ADDS.premium).toContain('Unlimited new words');
    expect(STEP_ADDS.premium).toContain(`${PLANS.premium.dailyTextMessages} messages`);
    expect(STEP_ADDS.premium).toContain(`${tutorMinutesPerMonth('premium')} tutor minutes a month`);
    expect(PLANS.premium.offlineMode).toBe(true);
    expect(STEP_ADDS.premium).toContain('offline');
  });

  it('quotes vip’s real caps and only claims features it actually has', () => {
    expect(STEP_ADDS.vip).toContain(`${PLANS.vip.dailyTextMessages} messages`);
    expect(STEP_ADDS.vip).toContain(`${tutorMinutesPerMonth('vip')} tutor minutes a month`);
    expect(PLANS.vip.audiobookNarration).toBe(true);
    expect(STEP_ADDS.vip).toContain('Audiobook narration');
    expect(isUnlimitedHints(PLANS.vip.dailyHints)).toBe(true);
    expect(STEP_ADDS.vip).toContain('unlimited hints');
  });

  it('never quotes the daily tutor cap, which overstates the feature', () => {
    // `dailyTutorMinutes` is the weaker of the two tutor ceilings; the monthly
    // spend cap bites first and is roughly twenty times smaller. Quoting the
    // daily figure would promise basic 450 minutes a month and deliver 24.
    for (const tier of STEP_ORDER) {
      expect(STEP_ADDS[tier]).not.toContain(`${PLANS[tier].dailyTutorMinutes} tutor`);
    }
  });

  it('contains no number that is not a real limit of that plan', () => {
    const allowed: Record<(typeof STEP_ORDER)[number], number[]> = {
      basic: [
        GOAL_TRACK_LESSONS,
        PLANS.basic.dailyNewCards,
        PLANS.basic.dailyTextMessages,
        tutorMinutesPerMonth('basic'),
      ],
      premium: [PLANS.premium.dailyTextMessages, tutorMinutesPerMonth('premium')],
      vip: [PLANS.vip.dailyTextMessages, tutorMinutesPerMonth('vip')],
    };

    for (const tier of STEP_ORDER) {
      const found = (STEP_ADDS[tier].match(/\d+/g) ?? []).map(Number);
      expect(found.length).toBeGreaterThan(0);
      for (const n of found) {
        expect(allowed[tier]).toContain(n);
      }
    }
  });
});

describe('PLAN_PROOF', () => {
  it('names the free tier’s real new-card ceiling', () => {
    expect(PLANS.starter.dailyNewCards).toBe(5);
    const words = PLAN_PROOF.find((r) => r.title === 'New words at your pace');
    expect(words?.detail).toBe(`Free stops at ${PLANS.starter.dailyNewCards} a day.`);
  });

  it('quotes the goal track’s real length', () => {
    expect(PLAN_PROOF[0].title).toBe(`Your ${GOAL_TRACK_LESSONS}-lesson plan`);
  });

  it('says a paid plan opens the track, not a specific paid tier', () => {
    // generate-goal-track entitles basic, premium and vip — every paid plan.
    // "Premium" here would be a false narrowing, "free" a false promise.
    expect(PLAN_PROOF[0].detail).toContain('any paid plan');
  });

  it('is three rows, each with a title and a detail', () => {
    expect(PLAN_PROOF).toHaveLength(3);
    for (const row of PLAN_PROOF) {
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.detail.length).toBeGreaterThan(0);
    }
  });
});

describe('FREE_EXIT_LINE', () => {
  it('states the free tier’s real new-card allowance', () => {
    expect(FREE_EXIT_LINE).toContain(`${PLANS.starter.dailyNewCards} new words a day`);
  });

  it('names what free keeps before naming what it does not', () => {
    // An informed decline (App Review 3.1.1). The kept list has to come first,
    // or the line reads as a threat rather than a summary.
    expect(FREE_EXIT_LINE.indexOf('Free keeps')).toBe(0);
    expect(FREE_EXIT_LINE).toMatch(/lessons, reviews, reading/);
    expect(FREE_EXIT_LINE).toMatch(/need a paid plan/);
  });

  it('carries no guilt, no urgency and no countdown', () => {
    // DESIGN.md §UX Psychology Principles §5 — binding, not optional.
    expect(FREE_EXIT_LINE).not.toMatch(/risk|lose|losing|miss out|hurry|expire/i);
  });

  it('mentions no number the free plan does not actually grant', () => {
    for (const n of (FREE_EXIT_LINE.match(/\d+/g) ?? []).map(Number)) {
      expect(n).toBe(PLANS.starter.dailyNewCards);
    }
  });
});

describe('learnerMoment', () => {
  it('passes a short answer through untouched', () => {
    expect(learnerMoment('Order dinner in Lyon without switching to English')).toBe(
      'Order dinner in Lyon without switching to English',
    );
  });

  it('has nothing to show for an absent or blank answer', () => {
    // Pre-migration-028 accounts are null; a skipped question can be whitespace.
    expect(learnerMoment(null)).toBeNull();
    expect(learnerMoment(undefined)).toBeNull();
    expect(learnerMoment('')).toBeNull();
    expect(learnerMoment('   \n  ')).toBeNull();
  });

  it('flattens the answer to one line', () => {
    // The field is a 300-char multiline box and the headline is one display
    // block — a typed newline would otherwise tear it into ragged pieces.
    expect(learnerMoment('  Talk to my\n\npartner’s   family  ')).toBe(
      'Talk to my partner’s family',
    );
  });

  it('cuts an over-long answer at a word boundary and marks the cut', () => {
    const long = 'I want to '.repeat(30); // 300 chars — the column's own maximum
    const flat = long.trim();
    const out = learnerMoment(long)!;

    expect(out.length).toBeLessThanOrEqual(MOMENT_MAX_CHARS + 1);
    expect(out.endsWith('…')).toBe(true);

    // Whatever survived is a genuine prefix of what the learner wrote, ending
    // where a word ends — not mid-word, and not with invented text.
    const body = out.slice(0, -1);
    expect(flat.startsWith(body)).toBe(true);
    expect(flat[body.length]).toBe(' ');
  });

  it('does not leave a stub when the answer is one unbroken run', () => {
    const out = learnerMoment('x'.repeat(300))!;
    expect(out.length).toBe(MOMENT_MAX_CHARS + 1);
  });

  it('leaves an answer of exactly the cap alone', () => {
    const exact = 'a'.repeat(MOMENT_MAX_CHARS);
    expect(learnerMoment(exact)).toBe(exact);
  });
});
