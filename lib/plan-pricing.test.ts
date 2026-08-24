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
} from './plan-pricing';
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
