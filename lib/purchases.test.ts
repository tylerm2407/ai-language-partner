import type { PurchasesPackage } from 'react-native-purchases';
import {
  annualSavingsPercent,
  isAnnualPackage,
  isMonthlyPackage,
  tierFromPackage,
} from './purchases';

// The native SDK is irrelevant to these helpers — they are pure functions over
// a store product. Mocking it keeps the module importable under jest.
// (babel-plugin-jest-hoist lifts this above the imports at transform time.)
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {},
  LOG_LEVEL: { WARN: 1 },
}));

/** Minimal stand-in for a RevenueCat package. */
function pkg(productId: string, packageType: string): PurchasesPackage {
  return {
    identifier: `pkg_${productId}`,
    packageType,
    product: { identifier: productId, price: 1, priceString: '$1.00' },
  } as unknown as PurchasesPackage;
}

describe('tierFromPackage', () => {
  it('maps each store product id to its tier', () => {
    expect(tierFromPackage(pkg('fluenci_vip_yearly', 'CUSTOM'))).toBe('vip');
    expect(tierFromPackage(pkg('fluenci_premium_monthly', 'CUSTOM'))).toBe('premium');
    expect(tierFromPackage(pkg('fluenci_basic_yearly', 'CUSTOM'))).toBe('basic');
  });

  it('falls back to starter for an unrecognised product', () => {
    expect(tierFromPackage(pkg('fluenci_mystery_monthly', 'CUSTOM'))).toBe('starter');
  });
});

describe('billing term', () => {
  // A RevenueCat offering has one $rc_monthly and one $rc_annual slot, so with
  // six products four of them necessarily carry a custom identifier and arrive
  // as packageType CUSTOM. The term has to come from the product id.
  it('reads the term from the product id when packageType is CUSTOM', () => {
    expect(isAnnualPackage(pkg('fluenci_vip_yearly', 'CUSTOM'))).toBe(true);
    expect(isAnnualPackage(pkg('fluenci_vip_monthly', 'CUSTOM'))).toBe(false);
    expect(isMonthlyPackage(pkg('fluenci_basic_monthly', 'CUSTOM'))).toBe(true);
    expect(isMonthlyPackage(pkg('fluenci_basic_yearly', 'CUSTOM'))).toBe(false);
  });

  it('still trusts packageType when RevenueCat sets it', () => {
    expect(isAnnualPackage(pkg('fluenci_premium_yearly', 'ANNUAL'))).toBe(true);
    expect(isMonthlyPackage(pkg('fluenci_premium_monthly', 'MONTHLY'))).toBe(true);
    expect(isAnnualPackage(pkg('fluenci_premium_monthly', 'MONTHLY'))).toBe(false);
    expect(isMonthlyPackage(pkg('fluenci_premium_yearly', 'ANNUAL'))).toBe(false);
  });

  it('accepts "annual" as well as "yearly" in the product id', () => {
    expect(isAnnualPackage(pkg('fluenci_vip_annual', 'CUSTOM'))).toBe(true);
  });

  it('treats a product with neither term as neither', () => {
    expect(isAnnualPackage(pkg('fluenci_vip_lifetime', 'CUSTOM'))).toBe(false);
    expect(isMonthlyPackage(pkg('fluenci_vip_lifetime', 'CUSTOM'))).toBe(false);
  });
});

describe('annualSavingsPercent', () => {
  it('matches the live App Store Connect prices', () => {
    expect(annualSavingsPercent(99.99, 9.99)).toBe(17);
    expect(annualSavingsPercent(199.99, 19.99)).toBe(17);
    expect(annualSavingsPercent(299.99, 29.99)).toBe(17);
  });

  it('claims nothing without a monthly price to compare against', () => {
    expect(annualSavingsPercent(99.99, undefined)).toBe(0);
    expect(annualSavingsPercent(99.99, 0)).toBe(0);
  });

  it('claims nothing when the annual price is not actually cheaper', () => {
    expect(annualSavingsPercent(120, 9.99)).toBe(0);
    expect(annualSavingsPercent(119.88, 9.99)).toBe(0);
  });
});
