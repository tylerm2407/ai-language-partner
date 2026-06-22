// Supabase Edge Function: RevenueCat Webhook Handler
//
// Keeps the `subscriptions` table (the source of truth for server-side quota
// enforcement via get_effective_limits) in sync with RevenueCat entitlements.
//
// Auth: RevenueCat lets you set a custom Authorization header on the webhook.
// Set REVENUECAT_WEBHOOK_AUTH as a function secret and paste the SAME value
// into the RevenueCat dashboard webhook "Authorization header value" field.
//
// Deploy: npx supabase functions deploy revenuecat-webhook --no-verify-jwt
// (RevenueCat does NOT send a Supabase JWT — verify_jwt MUST be false.)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Tier = 'starter' | 'basic' | 'premium' | 'vip';
const TIER_PRECEDENCE: Tier[] = ['vip', 'premium', 'basic'];

/** Map a RevenueCat entitlement id or product id to our tier. */
function resolveTier(entitlementIds: string[], productId: string | null): Tier {
  const hay = [...entitlementIds, productId ?? ''].join(' ').toLowerCase();
  for (const tier of TIER_PRECEDENCE) {
    if (hay.includes(tier)) return tier;
  }
  return 'starter';
}

// Events that mean "the user currently has access".
const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'SUBSCRIPTION_EXTENDED',
  'NON_RENEWING_PURCHASE',
]);
// Events that mean "access has ended".
const INACTIVE_EVENTS = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED', 'BILLING_ISSUE']);
// CANCELLATION = still active until period end (auto-renew off) → keep active, flag cancel.

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Shared-secret auth (constant-ish time comparison).
  const provided = req.headers.get('authorization') ?? '';
  if (!WEBHOOK_AUTH || provided !== WEBHOOK_AUTH) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = body.event as Record<string, unknown> | undefined;
  if (!event) return new Response(JSON.stringify({ ok: true }), { status: 200 });

  const type = String(event.type ?? '');
  // app_user_id is the Supabase user id we set via Purchases.configure/logIn.
  const userId = (event.app_user_id as string) ?? null;
  if (!userId) {
    console.error('[revenuecat-webhook] missing app_user_id on event', type);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // TRANSFER events move entitlements between users — ignore for tier sync.
  if (type === 'TRANSFER' || type === 'TEST') {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const entitlementIds = (event.entitlement_ids as string[]) ?? [];
  const productId = (event.product_id as string) ?? null;
  const expirationMs = event.expiration_at_ms as number | null | undefined;
  const currentPeriodEnd = expirationMs ? new Date(expirationMs).toISOString() : null;

  let tier: Tier;
  let isActive: boolean;
  let cancelAtPeriodEnd = false;

  if (INACTIVE_EVENTS.has(type)) {
    tier = 'starter';
    isActive = false;
  } else if (type === 'CANCELLATION') {
    // Auto-renew turned off but still entitled until period end.
    tier = resolveTier(entitlementIds, productId);
    isActive = true;
    cancelAtPeriodEnd = true;
  } else if (ACTIVE_EVENTS.has(type)) {
    tier = resolveTier(entitlementIds, productId);
    isActive = tier !== 'starter';
  } else {
    // Unknown event type — acknowledge without changing state.
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      tier,
      is_active: isActive,
      subscription_status: isActive ? 'active' : 'inactive',
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    // Return 500 so RevenueCat retries (it retries non-2xx).
    console.error('[revenuecat-webhook] subscriptions upsert failed:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
