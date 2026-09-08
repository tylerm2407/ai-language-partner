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

// The shared-secret header authenticates the caller; HMAC additionally proves
// the BODY was not altered, and its timestamp bounds replay. Without the
// secret configured, a leaked Authorization value is enough to write anyone's
// subscription row — so say so at boot rather than leaving it to be noticed.
if (!WEBHOOK_HMAC_SECRET) {
  console.warn(
    '[revenuecat-webhook] REVENUECAT_WEBHOOK_HMAC_SECRET is not set — running on the ' +
      'shared-secret header alone. Enable HMAC signing on the RevenueCat integration ' +
      'and set this secret; verification is enforced whenever it is present.',
  );
}

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

  const eventId = typeof event.id === 'string' ? event.id : null;
  if (!eventId) {
    console.error('[revenuecat-webhook] actionable event missing id', type);
    return new Response(JSON.stringify({ error: 'invalid_event' }), { status: 400 });
  }

  const { data: claim, error: claimError } = await supabase.rpc(
    'claim_revenuecat_event',
    {
      p_event_id: eventId,
      p_event_type: type,
      p_user_id: userId,
      p_event_data: {
        product_id: productId,
        entitlement_ids: entitlementIds,
        expiration_at_ms: expirationMs ?? null,
      },
      p_lease_seconds: 60,
    },
  );
  if (claimError) {
    console.error('[revenuecat-webhook] durable event claim failed:', claimError.message);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }
  const claimStatus = claim && typeof claim === 'object' && !Array.isArray(claim)
    ? String((claim as Record<string, unknown>).status ?? '')
    : '';
  if (claimStatus === 'completed') {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
  }
  if (claimStatus !== 'claimed') {
    return new Response(JSON.stringify({ error: 'event_busy' }), { status: 503 });
  }
  const leaseToken = String((claim as Record<string, unknown>).lease_token ?? '');
  if (!isPlausibleUuid(leaseToken)) {
    console.error('[revenuecat-webhook] event claim returned an invalid lease token');
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }

  // ── Ordering guard ─────────────────────────────────────────────────────
  // Webhook deliveries are not ordered, and a retried EXPIRATION can land
  // after the RENEWAL that superseded it. Applied blindly, that revokes a
  // subscriber who has already paid for the next period — the row says
  // starter/inactive, every quota drops to the free tier, and nothing looks
  // broken from RevenueCat's side.
  //
  // The guard reads off the domain's own monotonic quantity, `expiration_at_ms`
  // against the stored `current_period_end`, rather than a sequence number we
  // would have to store: an event describing a period that ends no later than
  // the one already recorded is describing the past.
  const { data: existing, error: existingError } = await supabase
    .from('subscriptions')
    .select('current_period_end, is_active')
    .eq('user_id', userId)
    .maybeSingle();
  if (existingError) {
    await markEventFailed(eventId, leaseToken, 'subscription state lookup failed');
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }

  const storedEndMs = existing?.current_period_end
    ? Date.parse(existing.current_period_end as string)
    : null;
  const staleAgainstStored =
    storedEndMs !== null &&
    Number.isFinite(storedEndMs) &&
    typeof expirationMs === 'number' &&
    expirationMs <= storedEndMs;

  // Only EXPIRATION is dropped outright, and only when the stored entitlement
  // runs well past now. Two deliberate narrowings:
  //
  //   • BILLING_ISSUE and SUBSCRIPTION_PAUSED are classified as non-terminal
  //     and never reach this mutation path. RevenueCat sends EXPIRATION when
  //     grace or the paid term actually ends.
  //   • A five-minute skew allowance, because an on-time EXPIRATION fires
  //     around the instant the period ends. Without it, delivery latency or a
  //     clock difference of seconds would make a genuine expiry look stale —
  //     and we answer 200, so RevenueCat would never resend it. The real bug
  //     this guards (a retried EXPIRATION landing after the RENEWAL that
  //     replaced it) leaves the stored end a whole billing period ahead, so
  //     the allowance costs nothing there.
  const STALE_SKEW_MS = 5 * 60 * 1000;
  if (
    type === 'EXPIRATION' &&
    staleAgainstStored &&
    existing?.is_active === true &&
    (storedEndMs as number) > Date.now() + STALE_SKEW_MS
  ) {
    console.log(
      `[revenuecat-webhook] ignoring stale EXPIRATION for ${userId}: its period ends ` +
        `${new Date(expirationMs as number).toISOString()}, but an active entitlement is ` +
        `already recorded through ${existing?.current_period_end}`,
    );
    const { error: completeError } = await supabase.rpc(
      'complete_revenuecat_event',
      { p_event_id: eventId, p_lease_token: leaseToken },
    );
    if (completeError) {
      await markEventFailed(eventId, leaseToken, 'stale event completion failed');
      return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true, stale: true }), { status: 200 });
  }

  // An out-of-order ACTIVE event must not shorten an entitlement either — a
  // redelivered RENEWAL for last month would otherwise pull current_period_end
  // backwards. The tier it carries is still applied, because a PRODUCT_CHANGE
  // mid-period is a legitimate reason for the tier to move without the period
  // end moving with it.
  const effectivePeriodEnd =
    isActive && staleAgainstStored ? (existing?.current_period_end as string) : currentPeriodEnd;

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
    await markEventFailed(eventId, leaseToken, 'unmapped active entitlement tier');
    return new Response(JSON.stringify({ error: 'configuration_error' }), { status: 500 });
  }

  const { error } = await supabase.rpc(
    'apply_revenuecat_entitlement_event',
    {
      p_event_id: eventId,
      p_lease_token: leaseToken,
      p_user_id: userId,
      p_tier: tier,
      p_is_active: isActive,
      p_subscription_status: isActive ? 'active' : 'inactive',
      p_current_period_end: effectivePeriodEnd,
      p_cancel_at_period_end: cancelAtPeriodEnd,
    },
  );

  if (error) {
    console.error('[revenuecat-webhook] atomic event application failed:', error.message);
    await markEventFailed(eventId, leaseToken, 'atomic entitlement application failed');
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});

async function markEventFailed(eventId: string, leaseToken: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('fail_revenuecat_event', {
    p_event_id: eventId,
    p_lease_token: leaseToken,
    p_error: reason,
  });
  if (error) {
    console.error('[revenuecat-webhook] failed to release event lease:', error.message);
  }
}
