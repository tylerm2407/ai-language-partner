import type { PurchasesPackage } from 'react-native-purchases';
import {
  annualSavingsPercent,
  isAnnualPackage,
  isMonthlyPackage,
  resolveKey,
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

describe('resolveKey', () => {
  // A wrong key is worse than no key: the SDK configures with it, every call
  // fails "Invalid API Key", and the paywall shows its generic empty state.
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('accepts a correctly-prefixed key for each platform', () => {
    expect(resolveKey('appl_KLvWOLovdOVLmzAkMwLfDNaqNOK', 'ios')).toBe(
      'appl_KLvWOLovdOVLmzAkMwLfDNaqNOK',
    );
    expect(resolveKey('goog_abcdefghijklmnopqrstuvwxyz', 'android')).toBe(
      'goog_abcdefghijklmnopqrstuvwxyz',
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('rejects a value that is not a RevenueCat key', () => {
    // The exact shape that took the paywall down in development.
    expect(resolveKey('test_OjnXJNDfDatFpZGJNvAgOkkNoFg', 'ios')).toBeUndefined();
    expect(resolveKey('test_OjnXJNDfDatFpZGJNvAgOkkNoFg', 'android')).toBeUndefined();
  });

  it('rejects a key pasted into the other platform slot', () => {
    expect(resolveKey('goog_abcdefghijklmnop', 'ios')).toBeUndefined();
    expect(resolveKey('appl_abcdefghijklmnop', 'android')).toBeUndefined();
  });

  it('rejects an unreplaced placeholder even though it carries the right prefix', () => {
    expect(resolveKey('appl_REPLACE_WITH_REVENUECAT_IOS_PUBLIC_KEY', 'ios')).toBeUndefined();
    expect(resolveKey('goog_REPLACE_WITH_REVENUECAT_ANDROID_PUBLIC_KEY', 'android')).toBeUndefined();
  });

  it('treats a missing or blank key as simply absent, without warning', () => {
    // The legitimate Expo Go / no-IAP build case — not a misconfiguration.
    expect(resolveKey(undefined, 'ios')).toBeUndefined();
    expect(resolveKey('', 'ios')).toBeUndefined();
    expect(resolveKey('   ', 'ios')).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns whenever a key is present but unusable, so the failure is findable', () => {
    resolveKey('test_OjnXJNDfDatFpZGJNvAgOkkNoFg', 'ios');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/ios RevenueCat key/);
  });

  it('never logs the key itself', () => {
    const secret = 'test_OjnXJNDfDatFpZGJNvAgOkkNoFg';
    resolveKey(secret, 'ios');
    expect(warn.mock.calls.flat().join(' ')).not.toContain(secret);
  });

  it('tolerates surrounding whitespace from a .env line', () => {
    expect(resolveKey('  appl_KLvWOLovdOVLmzAkMwLfDNaqNOK  ', 'ios')).toBe(
      'appl_KLvWOLovdOVLmzAkMwLfDNaqNOK',
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
