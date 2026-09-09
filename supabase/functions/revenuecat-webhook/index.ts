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
import { isRedisConfigured, redisSetNx } from '../_shared/redis.ts';
import { checkAuthorization, isPlausibleUuid, verifyWebhookSignature } from './auth.ts';
import { classifyEvent, isRevocation, INACTIVE_EVENTS } from './tier.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
const WEBHOOK_HMAC_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_HMAC_SECRET');

/** How long a processed event id is remembered. RevenueCat retries a failed
 *  delivery for hours, not days, so a day covers every legitimate redelivery
 *  with room to spare. */
/** See the SANDBOX block below. Defaults to accepting sandbox events. */
const ALLOW_SANDBOX_EVENTS = Deno.env.get('REVENUECAT_ALLOW_SANDBOX') !== 'false';
/** Comma-separated Supabase user ids whose SANDBOX events are honoured even
 *  when REVENUECAT_ALLOW_SANDBOX is 'false' — the founder's own test logins. */
const SANDBOX_TESTER_IDS: ReadonlySet<string> = new Set(
  (Deno.env.get('REVENUECAT_SANDBOX_USER_IDS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
);

const EVENT_DEDUPE_TTL_SECONDS = 86_400;

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
  const reason = typeof event.cancel_reason === 'string'
    ? event.cancel_reason
    : typeof event.expiration_reason === 'string'
      ? event.expiration_reason
      : null;

  // ── Sandbox ────────────────────────────────────────────────────────────
  // A sandbox purchase is a TestFlight or dev-build purchase that cost
  // nothing. Pre-launch every purchase is one, so they are accepted unless
  // REVENUECAT_ALLOW_SANDBOX is explicitly 'false' — SET IT BEFORE LAUNCH, or
  // anyone with a sandbox Apple ID buys VIP for free against production.
  if (event.environment === 'SANDBOX') {
    if (ALLOW_SANDBOX_EVENTS) {
      console.warn(`[revenuecat-webhook] accepting SANDBOX ${type} for ${userId} (REVENUECAT_ALLOW_SANDBOX is not 'false')`);
    } else if (SANDBOX_TESTER_IDS.has(userId)) {
      // A named tester account keeps working after launch; everyone else's
      // sandbox purchase is acknowledged and discarded.
      console.log(`[revenuecat-webhook] accepting SANDBOX ${type} for allow-listed tester ${userId}`);
    } else {
      console.log(`[revenuecat-webhook] ignoring SANDBOX ${type} for ${userId}`);
      return new Response(JSON.stringify({ ok: true, sandbox: true }), { status: 200 });
    }
  }

  // ── TRANSFER ───────────────────────────────────────────────────────────
  // The store subscription moved to another account (Restore Purchases on a
  // second login). Every later RENEWAL/EXPIRATION is addressed to the new
  // owner, so the OLD rows would otherwise stay active forever — one paid
  // subscription keeping an unbounded number of accounts entitled. Deactivate
  // every source account that is not also a destination.
  if (type === 'TRANSFER') {
    const from = Array.isArray(event.transferred_from) ? (event.transferred_from as unknown[]) : [];
    const to = new Set(
      (Array.isArray(event.transferred_to) ? (event.transferred_to as unknown[]) : [])
        .filter((id): id is string => typeof id === 'string'),
    );
    const losers = from.filter(
      (id): id is string => typeof id === 'string' && isPlausibleUuid(id) && !to.has(id) && id !== userId,
    );
    for (const loser of losers) {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          tier: 'starter',
          is_active: false,
          subscription_status: 'inactive',
          current_period_end: null,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', loser);
      if (error) {
        console.error(`[revenuecat-webhook] TRANSFER: could not deactivate ${loser}:`, error.message);
        return new Response(JSON.stringify({ error: 'internal' }), { status: 500 });
      }
      console.log(`[revenuecat-webhook] TRANSFER: deactivated ${loser} (entitlement moved to ${userId})`);
    }
    return new Response(JSON.stringify({ ok: true, transferred: losers.length }), { status: 200 });
  }

  // TEST and any unrecognised event type: acknowledge, change nothing.
  const decision = classifyEvent(type, entitlementIds, productId, reason);
  if (!decision) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  const { tier, isActive, cancelAtPeriodEnd } = decision;
  const revocation = isRevocation(type, reason);

  // ── At-most-once, best effort ──────────────────────────────────────────
  // RevenueCat retries any delivery it does not see a 2xx for, so the same
  // event id arrives more than once as a matter of course. Claiming the id
  // short-circuits the repeat. It is deliberately NOT the thing that makes
  // redelivery safe — Redis can be unconfigured, cold, or evicted, and the
  // claim is simply skipped then. What makes it safe is the ordering guard
  // below plus the upsert being idempotent.
  const eventId = typeof event.id === 'string' ? event.id : null;
  if (eventId && isRedisConfigured()) {
    try {
      const claimed = await redisSetNx(`rc:event:${eventId}`, '1', EVENT_DEDUPE_TTL_SECONDS);
      if (!claimed) {
        console.log(`[revenuecat-webhook] duplicate delivery of event ${eventId} (${type}) — ignored`);
        return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
      }
    } catch (err) {
      // Never fail a subscription write because the cache is down. Dropping a
      // real purchase is far worse than handling a duplicate.
      console.warn('[revenuecat-webhook] dedupe claim failed (non-fatal):', err);
    }
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
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('current_period_end, is_active')
    .eq('user_id', userId)
    .maybeSingle();

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
  //   • Not the other INACTIVE_EVENTS. BILLING_ISSUE and SUBSCRIPTION_PAUSED
  //     legitimately arrive MID-period carrying a grace-period end that is at
  //     or before the stored one; treating those as stale would silently turn
  //     a failed payment into continued access.
  //   • A five-minute skew allowance, because an on-time EXPIRATION fires
  //     around the instant the period ends. Without it, delivery latency or a
  //     clock difference of seconds would make a genuine expiry look stale —
  //     and we answer 200, so RevenueCat would never resend it. The real bug
  //     this guards (a retried EXPIRATION landing after the RENEWAL that
  //     replaced it) leaves the stored end a whole billing period ahead, so
  //     the allowance costs nothing there.
  // A REVOCATION is never stale. Its whole meaning is "the period ends
  // earlier than you were told" — a refund, a chargeback, a developer revoke —
  // and reading that as a retried old event kept refunded subscribers
  // entitled until the original period end.
  const STALE_SKEW_MS = 5 * 60 * 1000;
  if (
    type === 'EXPIRATION' &&
    !revocation &&
    staleAgainstStored &&
    existing?.is_active === true &&
    (storedEndMs as number) > Date.now() + STALE_SKEW_MS
  ) {
    console.log(
      `[revenuecat-webhook] ignoring stale EXPIRATION for ${userId}: its period ends ` +
        `${new Date(expirationMs as number).toISOString()}, but an active entitlement is ` +
        `already recorded through ${existing?.current_period_end}`,
    );
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
  }

  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      tier,
      is_active: isActive,
      subscription_status: isActive ? 'active' : 'inactive',
      current_period_end: effectivePeriodEnd,
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
