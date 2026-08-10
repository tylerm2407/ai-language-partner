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
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  type PurchasesOffering,
  LOG_LEVEL,
} from 'react-native-purchases';
import type { PlanId } from './plans';

/**
 * Return a usable RevenueCat key, or undefined if it is missing or an
 * unreplaced `appl_REPLACE_WITH_…` / `goog_REPLACE_WITH_…` placeholder.
 * Without this, a production build with placeholder keys still passes the
 * `Boolean(key)` check, configures the SDK with a dummy key, and ships a
 * dead paywall (offerings/purchases silently fail → $0 revenue).
 */
function resolveKey(key: string | undefined): string | undefined {
  if (!key || key.includes('REPLACE_WITH')) return undefined;
  return key;
}

const IOS_KEY = resolveKey(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY);
const ANDROID_KEY = resolveKey(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY);

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

export interface PurchaseResult {
  status: 'success' | 'cancelled' | 'error';
  tier?: PlanId;
  message?: string;
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
    return { status: 'error', message: err.message ?? 'Purchase failed. Please try again.' };
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
    const err = e as { message?: string };
    return { status: 'error', message: err.message ?? 'Could not restore purchases.' };
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
