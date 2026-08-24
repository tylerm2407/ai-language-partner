/**
 * RevenueCat / in-app-purchase integration.
 *
 * RevenueCat is the source of truth for *entitlements* (what the user has
 * bought). The Supabase `subscriptions` table is kept in sync server-side by
 * the `revenuecat-webhook` edge function, so server quota enforcement
 * (get_effective_limits) stays correct. The client reads RevenueCat directly
 * for instant UI gating.
 *
 * Native module — requires a development/production build (NOT Expo Go).
 *
 * Store product IDs (create these EXACTLY in App Store Connect + Play Console,
 * then attach each to the matching entitlement in RevenueCat):
 *   fluenci_basic_monthly    -> entitlement "basic"
 *   fluenci_basic_yearly     -> entitlement "basic"
 *   fluenci_premium_monthly  -> entitlement "premium"
 *   fluenci_premium_yearly   -> entitlement "premium"
 *   fluenci_vip_monthly      -> entitlement "vip"
 *   fluenci_vip_yearly       -> entitlement "vip"
 */
import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  type PurchasesOffering,
  LOG_LEVEL,
} from 'react-native-purchases';
import type { PlanId } from './plans';

/**
 * RevenueCat public SDK key prefixes. The keys are issued per platform and are
 * NOT interchangeable — an Android key in the iOS slot fails the same way a
 * junk value does.
 */
const KEY_PREFIX = { ios: 'appl_', android: 'goog_' } as const;

export type PurchasePlatform = keyof typeof KEY_PREFIX;

/**
 * Return a usable RevenueCat key, or undefined if it cannot possibly be one.
 *
 * A wrong key is worse than no key: `Purchases.configure()` accepts it, every
 * subsequent call fails with "Invalid API Key", and the paywall renders its
 * generic "couldn't load plans" state — so a build ships with a dead paywall
 * and $0 revenue, and the only clue is a native log line.
 *
 * This screens three ways that has actually happened here:
 *   - an unreplaced `appl_REPLACE_WITH_…` placeholder;
 *   - a value that is not a RevenueCat key at all (a `test_…` string sat in
 *     .env and took the paywall down in development);
 *   - a correctly-formed key pasted into the other platform's variable.
 *
 * A missing key is left silent — that is the legitimate Expo Go / no-IAP
 * build case. A key that is *present but wrong* warns loudly, because that is
 * always a misconfiguration and the failure is otherwise invisible until
 * someone opens the paywall.
 */
export function resolveKey(
  key: string | undefined,
  platform: PurchasePlatform,
): string | undefined {
  const trimmed = key?.trim();
  if (!trimmed) return undefined;

  const expected = KEY_PREFIX[platform];
  const bad =
    trimmed.includes('REPLACE_WITH') ? 'is an unreplaced placeholder'
    : !trimmed.startsWith(expected) ? `does not start with "${expected}"`
    : null;

  if (bad) {
    // Never log the value itself — it is a credential, junk or not.
    console.warn(
      `[purchases] Ignoring the ${platform} RevenueCat key: it ${bad}. ` +
        'In-app purchases are disabled and the paywall will show no plans.',
    );
    return undefined;
  }
  return trimmed;
}

const IOS_KEY = resolveKey(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, 'ios');
const ANDROID_KEY = resolveKey(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY, 'android');

/** Paid tiers that map to RevenueCat entitlements (excludes the free 'starter'). */
type PaidTier = Exclude<PlanId, 'starter'>;

/** Entitlement identifiers configured in the RevenueCat dashboard. */
export const ENTITLEMENTS: Record<PaidTier, string> = {
  basic: 'basic',
  premium: 'premium',
  vip: 'vip',
};

/** Tier precedence, highest first — used to resolve the active tier. */
const TIER_PRECEDENCE: PaidTier[] = ['vip', 'premium', 'basic'];

let configured = false;

/** Whether IAP is usable on this build (keys present + native module available). */
export function isPurchasesAvailable(): boolean {
  const key = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
  return Boolean(key);
}

/**
 * Configure RevenueCat once, tied to the Supabase user id so the webhook can
 * map entitlement events back to the right user. Safe to call repeatedly.
 */
export function configurePurchases(appUserId: string | null): void {
  if (configured) return;
  const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
  if (!apiKey) {
    // No key on this platform/build (e.g. Expo Go) — leave unconfigured.
    return;
  }
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({ apiKey, appUserID: appUserId ?? undefined });
  configured = true;
}

/** Associate purchases with a signed-in user (call on login). */
export async function identifyPurchaser(appUserId: string): Promise<void> {
  if (!configured || !isPurchasesAvailable()) return;
  try {
    await Purchases.logIn(appUserId);
  } catch (err) {
    console.warn('[purchases] logIn failed:', err);
  }
}

/** Detach the user (call on logout) so purchases aren't attributed to them. */
export async function resetPurchaser(): Promise<void> {
  if (!configured || !isPurchasesAvailable()) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    // logOut throws for anonymous users — non-fatal.
    console.warn('[purchases] logOut skipped:', err);
  }
}

/** Fetch the current offering's packages (drives the paywall UI). */
export async function getOfferingPackages(): Promise<PurchasesPackage[]> {
  if (!isPurchasesAvailable()) return [];
  const offerings = await Purchases.getOfferings();
  const current: PurchasesOffering | null = offerings.current;
  return current?.availablePackages ?? [];
}

/** Resolve the user's active tier from RevenueCat entitlements. */
export function tierFromCustomerInfo(info: CustomerInfo): PlanId {
  const active = info.entitlements.active;
  for (const tier of TIER_PRECEDENCE) {
    if (active[ENTITLEMENTS[tier]]) return tier;
  }
  return 'starter';
}

/** Map a store package to the tier it grants (by product identifier convention). */
export function tierFromPackage(pkg: PurchasesPackage): PlanId {
  const id = pkg.product.identifier.toLowerCase();
  if (id.includes('vip')) return 'vip';
  if (id.includes('premium')) return 'premium';
  if (id.includes('basic')) return 'basic';
  return 'starter';
}

/**
 * Billing term of a package.
 *
 * `packageType` is only MONTHLY/ANNUAL for RevenueCat's reserved
 * `$rc_monthly` / `$rc_annual` identifiers, and an offering has one slot for
 * each. Six products (three tiers x two terms) therefore leave four packages
 * on custom identifiers, arriving as CUSTOM — so the term falls back to the
 * store product id, the same convention `tierFromPackage` relies on. Without
 * this an annual package renders its yearly price labelled "/month".
 */
export function isAnnualPackage(pkg: PurchasesPackage): boolean {
  if (pkg.packageType === 'ANNUAL') return true;
  if (pkg.packageType === 'MONTHLY') return false;
  const id = pkg.product.identifier.toLowerCase();
  return id.includes('yearly') || id.includes('annual');
}

export function isMonthlyPackage(pkg: PurchasesPackage): boolean {
  if (pkg.packageType === 'MONTHLY') return true;
  if (pkg.packageType === 'ANNUAL') return false;
  return pkg.product.identifier.toLowerCase().includes('monthly');
}

/**
 * Whole-percent saving of an annual price against twelve months of the monthly
 * one. Returns 0 when there is nothing honest to claim — no monthly price to
 * compare against, or an annual price that is not actually cheaper.
 */
export function annualSavingsPercent(annualPrice: number, monthlyPrice: number | undefined): number {
  if (!monthlyPrice || monthlyPrice <= 0 || annualPrice <= 0) return 0;
  const pct = Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);
  return pct > 0 ? pct : 0;
}

export interface PurchaseResult {
  status: 'success' | 'cancelled' | 'error';
  tier?: PlanId;
  message?: string;
  /** RevenueCat PURCHASES_ERROR_CODE, when the SDK supplied one. */
  code?: string;
}

/**
 * Record a failed purchase or restore.
 *
 * A revenue-path failure used to leave no trace anywhere: `trackEvent` is a
 * no-op until an analytics provider is registered (lib/analytics.ts), the
 * alert is transient, and nothing reached Sentry. The only evidence a purchase
 * had ever failed was the learner's word for it. Anything that stops money
 * arriving deserves a breadcrumb.
 *
 * Never pass the raw error object — RevenueCat error payloads can carry
 * receipt and account identifiers.
 */
export function reportPurchaseFailure(
  stage: 'purchase' | 'restore',
  message: string | undefined,
  tier?: PlanId,
  code?: string,
): void {
  const detail = message ?? 'unknown error';
  console.warn(`[purchases] ${stage} failed:`, detail, code ? `(${code})` : '');
  Sentry.captureMessage(`IAP ${stage} failed: ${detail}`, {
    level: 'error',
    tags: { iap_stage: stage, iap_code: code ?? 'none', iap_tier: tier ?? 'unknown' },
  });
}

/** Purchase a package. Returns a tagged result (cancellation is not an error). */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!isPurchasesAvailable()) {
    return { status: 'error', message: 'In-app purchases are not available on this device.' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { status: 'success', tier: tierFromCustomerInfo(customerInfo) };
  } catch (e) {
    const err = e as { code?: string; userCancelled?: boolean; message?: string };
    if (err.userCancelled || err.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { status: 'cancelled' };
    }
    return {
      status: 'error',
      message: err.message ?? 'Purchase failed. Please try again.',
      code: err.code,
    };
  }
}

/** Restore previous purchases (App Store requirement). */
export async function restorePurchases(): Promise<PurchaseResult> {
  if (!isPurchasesAvailable()) {
    return { status: 'error', message: 'In-app purchases are not available on this device.' };
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    const tier = tierFromCustomerInfo(customerInfo);
    return { status: 'success', tier };
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return { status: 'error', message: err.message ?? 'Could not restore purchases.', code: err.code };
  }
}

/** Read the current entitlement tier (instant UI gating). */
export async function getCurrentTier(): Promise<PlanId> {
  if (!isPurchasesAvailable()) return 'starter';
  try {
    const info = await Purchases.getCustomerInfo();
    return tierFromCustomerInfo(info);
  } catch {
    return 'starter';
  }
}

/**
 * Subscribe to entitlement changes.
 *
 * This is what closes the window between "the store took the money" and "the
 * `subscriptions` row says so". The row is written by the revenuecat-webhook
 * function, which is a network round-trip away at best and, if RevenueCat
 * exhausts its five retries, may never arrive at all. Gating solely on that
 * row means a paying learner gets bounced back onto the paywall — so the
 * client listens to the entitlement it already holds locally and treats the
 * table as the durable backstop rather than the gate.
 *
 * Fires immediately with the cached CustomerInfo on registration, then on
 * every purchase, restore, renewal and expiry the SDK observes.
 *
 * Returns an unsubscribe function; a no-op when IAP isn't available on this
 * build (Expo Go, or a missing/rejected key).
 */
export function addEntitlementListener(onTier: (tier: PlanId) => void): () => void {
  if (!configured || !isPurchasesAvailable()) return () => {};
  try {
    const remove = Purchases.addCustomerInfoUpdateListener((info) => {
      onTier(tierFromCustomerInfo(info));
    });
    // Prime with what the SDK already has cached, so a cold start on an
    // entitled device doesn't flash the paywall while waiting for an event.
    getCurrentTier().then(onTier).catch(() => {});
    return typeof remove === 'function' ? remove : () => {};
  } catch (err) {
    console.warn('[purchases] entitlement listener failed:', err);
    return () => {};
  }
}
