// Deno tests for RevenueCat tier resolution + event classification (tier.ts).
//
// Run with: `deno test supabase/functions/revenuecat-webhook/tier.test.ts`
//
// We test tier.ts directly (pure module) instead of importing ./index.ts,
// which calls `serve(...)` at import time and reads env secrets — same
// pattern as auth.test.ts.
//
// Why this file exists: every way this logic can be wrong is SILENT. The
// webhook returns 200, RevenueCat's dashboard shows a healthy delivery, and
// the only symptom is a paying customer whose `subscriptions` row says
// `starter`. There is no error to notice.

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { resolveTier, classifyEvent } from './tier.ts';

// ------------------------------------------------------------ resolveTier

Deno.test('resolveTier: entitlement id alone resolves each tier', () => {
  assertEquals(resolveTier(['basic'], null), 'basic');
  assertEquals(resolveTier(['premium'], null), 'premium');
  assertEquals(resolveTier(['vip'], null), 'vip');
});

Deno.test('resolveTier: product id alone resolves each tier', () => {
  // The six store product ids documented in lib/purchases.ts.
  assertEquals(resolveTier([], 'fluenci_basic_monthly'), 'basic');
  assertEquals(resolveTier([], 'fluenci_basic_yearly'), 'basic');
  assertEquals(resolveTier([], 'fluenci_premium_monthly'), 'premium');
  assertEquals(resolveTier([], 'fluenci_premium_yearly'), 'premium');
  assertEquals(resolveTier([], 'fluenci_vip_monthly'), 'vip');
  assertEquals(resolveTier([], 'fluenci_vip_yearly'), 'vip');
});

Deno.test('resolveTier: case-insensitive', () => {
  // RevenueCat entitlements are often titled "Premium" in the dashboard.
  assertEquals(resolveTier(['Premium'], null), 'premium');
  assertEquals(resolveTier(['VIP'], null), 'vip');
  assertEquals(resolveTier([], 'Fluenci_Basic_Monthly'), 'basic');
});

Deno.test('resolveTier: highest tier wins when several are present', () => {
  // Order in the array must not decide the outcome — precedence does.
  assertEquals(resolveTier(['basic', 'vip'], null), 'vip');
  assertEquals(resolveTier(['vip', 'basic'], null), 'vip');
  assertEquals(resolveTier(['basic', 'premium'], null), 'premium');
  // An upgrade event can carry the old entitlement and the new product.
  assertEquals(resolveTier(['basic'], 'fluenci_vip_yearly'), 'vip');
});

Deno.test('resolveTier: unknown identifiers fall back to starter', () => {
  // THE configuration mismatch this whole file is guarding: if the
  // RevenueCat entitlements are renamed to anything not containing
  // basic/premium/vip, every purchase silently resolves to `starter`.
  assertEquals(resolveTier(['pro'], null), 'starter');
  assertEquals(resolveTier(['tier_2'], 'fluenci_plus_monthly'), 'starter');
  assertEquals(resolveTier([], null), 'starter');
  assertEquals(resolveTier([], ''), 'starter');
});

// ---------------------------------------------------------- classifyEvent

Deno.test('classifyEvent: a purchase grants the tier and activates', () => {
  assertEquals(classifyEvent('INITIAL_PURCHASE', ['premium'], 'fluenci_premium_monthly'), {
    tier: 'premium',
    isActive: true,
    cancelAtPeriodEnd: false,
  });
});

Deno.test('classifyEvent: every active event type grants access', () => {
  for (const type of [
    'INITIAL_PURCHASE',
    'RENEWAL',
    'PRODUCT_CHANGE',
    'UNCANCELLATION',
    'SUBSCRIPTION_EXTENDED',
    'NON_RENEWING_PURCHASE',
  ]) {
    assertEquals(
      classifyEvent(type, ['vip'], null),
      { tier: 'vip', isActive: true, cancelAtPeriodEnd: false },
      `${type} should grant access`,
    );
  }
});

Deno.test('classifyEvent: CANCELLATION keeps access until the period end', () => {
  // Auto-renew off is NOT loss of access — downgrading here would take away
  // time the customer has already paid for.
  assertEquals(classifyEvent('CANCELLATION', ['premium'], null), {
    tier: 'premium',
    isActive: true,
    cancelAtPeriodEnd: true,
  });
});

Deno.test('classifyEvent: expiry revokes access', () => {
  assertEquals(classifyEvent('EXPIRATION', ['premium'], null), {
    tier: 'starter',
    isActive: false,
    cancelAtPeriodEnd: false,
  });
});

Deno.test('classifyEvent: BILLING_ISSUE currently revokes access immediately', () => {
  // Documents CURRENT behaviour, and it is worth questioning: BILLING_ISSUE
  // fires at the START of a billing problem, while the store grace period
  // may still entitle the user. See LAUNCH-READINESS-AUDIT P1-3 — the
  // suggested change is to let EXPIRATION do the downgrade and treat this as
  // a flag only. Change this test deliberately if that lands.
  assertEquals(classifyEvent('BILLING_ISSUE', ['premium'], null), {
    tier: 'starter',
    isActive: false,
    cancelAtPeriodEnd: false,
  });
});

Deno.test('classifyEvent: TEST and TRANSFER change nothing', () => {
  // TEST is the dashboard's "Send test webhook" button — it must never
  // write. TRANSFER moves entitlements between users and is out of scope.
  assertEquals(classifyEvent('TEST', ['premium'], 'fluenci_premium_monthly'), null);
  assertEquals(classifyEvent('TRANSFER', ['premium'], null), null);
});

Deno.test('classifyEvent: an unknown event type changes nothing', () => {
  // Load-bearing: a future RevenueCat event type must not be able to revoke
  // a paying customer's access just because we do not recognise it.
  assertEquals(classifyEvent('SOME_FUTURE_EVENT', ['premium'], null), null);
  assertEquals(classifyEvent('', ['premium'], null), null);
});

Deno.test('classifyEvent: an active event with no readable tier stays inactive', () => {
  // tier and isActive must agree. Writing is_active = true alongside tier
  // `starter` would claim an entitlement to nothing, and the app's
  // effectiveTier() would then treat it as no subscription anyway.
  assertEquals(classifyEvent('INITIAL_PURCHASE', ['pro'], 'fluenci_plus_monthly'), {
    tier: 'starter',
    isActive: false,
    cancelAtPeriodEnd: false,
  });
});
