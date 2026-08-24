// Tier + event classification for the RevenueCat webhook.
//
// Pure functions — no env access, no I/O — so they can be unit-tested
// (tier.test.ts) without booting the edge function (index.ts calls `serve()`
// at import time). Same split as auth.ts.
//
// This is the code that decides whether someone who just paid actually gets
// what they bought, and every way it can be wrong is SILENT: the webhook
// still returns 200 and RevenueCat's dashboard shows a healthy delivery
// while the `subscriptions` row says `starter`.

export type Tier = 'starter' | 'basic' | 'premium' | 'vip';

/** Highest first — the first match wins, so a bundle naming two tiers
 *  resolves to the richer one rather than to whichever appears first in
 *  the entitlement array. */
export const TIER_PRECEDENCE: Tier[] = ['vip', 'premium', 'basic'];

/**
 * Map RevenueCat entitlement ids / product id to our tier.
 *
 * Substring matching against the joined haystack, which is deliberate: it
 * accepts both the entitlement identifiers configured in the RevenueCat
 * dashboard (`basic` / `premium` / `vip`) and the store product ids
 * (`fluenci_premium_yearly`), so a purchase still resolves if only one of
 * the two is present on the event.
 *
 * The coupling this creates is the important part: if the RevenueCat
 * entitlements are ever renamed to something that does not CONTAIN one of
 * these three words — `pro`, `tier_2`, `plus` — every purchase silently
 * resolves to `starter` and the paying customer is written inactive. The
 * client half (lib/purchases.ts ENTITLEMENTS / tierFromPackage) makes the
 * same assumption, so they must be renamed together or not at all.
 */
export function resolveTier(entitlementIds: string[], productId: string | null): Tier {
  const hay = [...entitlementIds, productId ?? ''].join(' ').toLowerCase();
  for (const tier of TIER_PRECEDENCE) {
    if (hay.includes(tier)) return tier;
  }
  return 'starter';
}

/** Events that mean "the user currently has access". */
export const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'SUBSCRIPTION_EXTENDED',
  'NON_RENEWING_PURCHASE',
]);

/** Events that mean "access has ended". */
export const INACTIVE_EVENTS = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED', 'BILLING_ISSUE']);

/** Events acknowledged without touching subscription state at all.
 *  TRANSFER moves entitlements between users; TEST is the dashboard's
 *  "Send test webhook" button. */
export const IGNORED_EVENTS = new Set(['TRANSFER', 'TEST']);

export interface TierDecision {
  tier: Tier;
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
}

/**
 * Decide what to write for an event, or `null` for "acknowledge (200) and
 * change nothing" — which covers both the deliberately ignored events and
 * any event type RevenueCat adds later that we do not understand yet.
 * Returning null rather than defaulting to a tier is what stops an unknown
 * future event from revoking a paying customer's access.
 */
export function classifyEvent(
  type: string,
  entitlementIds: string[],
  productId: string | null,
): TierDecision | null {
  if (IGNORED_EVENTS.has(type)) return null;

  if (INACTIVE_EVENTS.has(type)) {
    return { tier: 'starter', isActive: false, cancelAtPeriodEnd: false };
  }

  // Auto-renew turned off, but still entitled until the period end.
  if (type === 'CANCELLATION') {
    return {
      tier: resolveTier(entitlementIds, productId),
      isActive: true,
      cancelAtPeriodEnd: true,
    };
  }

  if (ACTIVE_EVENTS.has(type)) {
    const tier = resolveTier(entitlementIds, productId);
    // An active event that resolves to `starter` means we could not read a
    // tier off the event at all. Writing is_active = true with tier
    // `starter` would be incoherent (entitled to nothing), so the two stay
    // consistent — and the mismatch shows up in the row rather than being
    // papered over.
    return { tier, isActive: tier !== 'starter', cancelAtPeriodEnd: false };
  }

  return null;
}
