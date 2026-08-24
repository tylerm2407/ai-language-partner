// Supabase Edge Function: RevenueCat Webhook Handler
//
// Keeps the `subscriptions` table (the source of truth for server-side quota
// enforcement via get_effective_limits) in sync with RevenueCat entitlements.
//
// Auth: RevenueCat lets you set a custom Authorization header on the webhook.
// Set REVENUECAT_WEBHOOK_AUTH as a function secret and paste the SAME value
// into the RevenueCat dashboard webhook "Authorization header value" field.
//
// Optional, stronger: enable "HMAC webhook signing" on the integration in the
// RevenueCat dashboard and store the signing secret as the
// REVENUECAT_WEBHOOK_HMAC_SECRET function secret. When that secret is set,
// the X-RevenueCat-Webhook-Signature header is required and verified.
// https://www.revenuecat.com/docs/integrations/webhooks#security-and-best-practices
//
// Deploy: npx supabase functions deploy revenuecat-webhook --no-verify-jwt
// (RevenueCat does NOT send a Supabase JWT — verify_jwt MUST be false.)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkAuthorization, isPlausibleUuid, verifyWebhookSignature } from './auth.ts';
import { classifyEvent, INACTIVE_EVENTS } from './tier.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
const WEBHOOK_HMAC_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_HMAC_SECRET');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Tier resolution and event classification live in ./tier.ts — pure and
// unit-tested there (tier.test.ts). CANCELLATION keeps access until the
// period end with the cancel flag set; unknown event types change nothing.

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Shared-secret auth (constant-time). Fails CLOSED when the secret is
  // unconfigured — never process an event without a verified caller.
  const authResult = await checkAuthorization(req.headers.get('authorization'), WEBHOOK_AUTH);
  if (authResult === 'config_error') {
    console.error('[revenuecat-webhook] REVENUECAT_WEBHOOK_AUTH is not set — rejecting all events');
    return new Response('Server configuration error', { status: 500 });
  }
  if (authResult !== 'ok') {
    return new Response('Unauthorized', { status: 401 });
  }

  // Read the raw body BEFORE parsing — the HMAC covers the exact bytes sent.
  const rawBody = await req.text();

  // Defense-in-depth: if HMAC signing is configured, a valid signature is required.
  if (WEBHOOK_HMAC_SECRET) {
    const validSignature = await verifyWebhookSignature(
      rawBody,
      req.headers.get('x-revenuecat-webhook-signature'),
      WEBHOOK_HMAC_SECRET
    );
    if (!validSignature) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
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
  // Only plausible Supabase auth UUIDs may reach the DB. RevenueCat anonymous
  // ids ($RCAnonymousID:...) or anything else: acknowledge, don't sync.
  if (!isPlausibleUuid(userId)) {
    console.error('[revenuecat-webhook] non-UUID app_user_id on event', type);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const entitlementIds = (event.entitlement_ids as string[]) ?? [];
  const productId = (event.product_id as string) ?? null;
  const expirationMs = event.expiration_at_ms as number | null | undefined;
  const currentPeriodEnd = expirationMs ? new Date(expirationMs).toISOString() : null;

  // TRANSFER/TEST and any unrecognised event type: acknowledge, change nothing.
  const decision = classifyEvent(type, entitlementIds, productId);
  if (!decision) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  const { tier, isActive, cancelAtPeriodEnd } = decision;

  // An active event that could not be resolved to a tier is a configuration
  // mismatch between the RevenueCat dashboard and tier.ts, and it is
  // otherwise invisible: the row just says `starter` and the delivery looks
  // healthy. Log it loudly — this is a paying customer getting nothing.
  if (!isActive && tier === 'starter' && !INACTIVE_EVENTS.has(type)) {
    console.error(
      `[revenuecat-webhook] ${type} did not resolve to a tier — check that the ` +
        'RevenueCat entitlement ids contain basic/premium/vip. entitlements=' +
        JSON.stringify(entitlementIds) + ' product=' + String(productId),
    );
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
    // Return 500 so RevenueCat retries (it retries non-2xx). Log the detail
    // server-side only — never echo internal error messages to the caller.
    console.error('[revenuecat-webhook] subscriptions upsert failed:', error.message);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
