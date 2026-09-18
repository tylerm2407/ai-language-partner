// Supabase Edge Function: referral-rewards (service-role only)
//
// Fired hourly by pg_cron (migration 148). Hands out the free time referrers
// have earned once a friend's first payment clears its 7-day hold:
//   • App Store subscriber → Apple renewal-date extension (30 days, or 15 on VIP)
//   • anyone else          → RevenueCat promotional Premium, 30 days per reward
// The database decides who gets what (claim_referral_deliveries); ./deliver.ts
// carries it out. This file is serve() + auth + wiring.
//
// Auth: bearer compared in constant time against the Vault cron secret, the
// same mechanism as tutor-session-reaper, so verify_jwt = false in config.toml.
//
// Secrets:
//   REVENUECAT_SECRET_API_KEY          already set (v1 secret key)
//   APPSTORE_SERVER_KEY_ID             App Store Connect key id
//   APPSTORE_SERVER_ISSUER_ID          App Store Connect issuer id
//   APPSTORE_SERVER_PRIVATE_KEY        the .p8 contents
//   APPSTORE_BUNDLE_ID                 optional, defaults to com.fluenci.app
// Without the three APPSTORE_* values, App Store referrers' rewards wait in
// 'ready' (nothing is lost) and promo rewards still go out.
//
// Deploy: npx supabase functions deploy referral-rewards --project-ref ngqpsuixmumdnqbqxjxv

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { extendRenewalDate, type AppleServerKey } from './apple.ts';
import { grantPromotional, premiumExpiryMs } from './revenuecat.ts';
import { runReferralDeliveries, type Delivery } from './deliver.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REVENUECAT_SECRET_API_KEY = Deno.env.get('REVENUECAT_SECRET_API_KEY') ?? '';

const FN = 'referral-rewards';

function appleKey(): AppleServerKey | null {
  const keyId = Deno.env.get('APPSTORE_SERVER_KEY_ID') ?? '';
  const issuerId = Deno.env.get('APPSTORE_SERVER_ISSUER_ID') ?? '';
  const privateKeyPem = Deno.env.get('APPSTORE_SERVER_PRIVATE_KEY') ?? '';
  if (!keyId || !issuerId || !privateKeyPem) return null;
  return { keyId, issuerId, privateKeyPem, bundleId: Deno.env.get('APPSTORE_BUNDLE_ID') ?? 'com.fluenci.app' };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Cron-shared-secret auth (copied from tutor-session-reaper) ────────
  const { data: secretData, error: secretErr } = await supabase.rpc('get_cron_secret');
  if (secretErr || !secretData) {
    return json({ error: 'Cron secret unavailable — Vault entry missing' }, 500);
  }
  const cronSecret = secretData as string;
  if (cronSecret.length < 16) {
    console.error('[SECURITY] CRON_SECRET is missing or too short. Set a 32+ byte random value in Vault.');
    return json({ error: 'Cron secret is not configured securely' }, 500);
  }
  const providedKey = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!providedKey || providedKey.length !== cronSecret.length) {
    return json({ error: 'Unauthorized — cron invocation only' }, 401);
  }
  const a = new TextEncoder().encode(providedKey);
  const b = new TextEncoder().encode(cronSecret);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  if (mismatch !== 0) {
    return json({ error: 'Unauthorized — cron invocation only' }, 401);
  }

  if (!REVENUECAT_SECRET_API_KEY) {
    console.error(`[${FN}] REVENUECAT_SECRET_API_KEY is not set; nothing can be delivered`);
    return json({ error: 'server_configuration_error' }, 500);
  }
  const apple = appleKey();
  if (!apple) {
    console.warn(`[${FN}] APPSTORE_SERVER_* secrets not set; App Store referrers' rewards are waiting`);
  }

  try {
    const summary = await runReferralDeliveries({
      appleEnabled: apple !== null,
      claim: async (appleEnabled) => {
        const { data, error } = await supabase.rpc('claim_referral_deliveries', {
          p_apple_enabled: appleEnabled,
          p_limit: 25,
        });
        if (error) throw new Error(`claim failed: ${error.message}`);
        return (data ?? []) as Delivery[];
      },
      extendApple: (d) =>
        extendRenewalDate(apple as AppleServerKey, {
          originalTransactionId: d.original_transaction_id as string,
          days: d.days,
          requestIdentifier: d.id,
          environment: d.environment,
        }),
      premiumExpiryMs: (userId) => premiumExpiryMs(userId, REVENUECAT_SECRET_API_KEY),
      fixPromoTarget: async (deliveryId, endAt) => {
        const { data, error } = await supabase.rpc('set_referral_promo_target', {
          p_delivery_id: deliveryId,
          p_end_at: endAt,
        });
        if (error) throw new Error(`promo target failed: ${error.message}`);
        return (data as string | null) ?? null;
      },
      grantPromo: (userId, endMs) => grantPromotional(userId, endMs, REVENUECAT_SECRET_API_KEY),
      finish: async (deliveryId, success, externalRef, err) => {
        const { error } = await supabase.rpc('finish_referral_delivery', {
          p_delivery_id: deliveryId,
          p_success: success,
          p_external_ref: externalRef,
          p_error: err,
        });
        // Left 'pending', the next run re-offers it under the same id.
        if (error) console.error(`[${FN}] finish failed for ${deliveryId}: ${error.message}`);
        if (!success) console.error(`[${FN}] delivery ${deliveryId} failed: ${err}`);
      },
      now: () => Date.now(),
    });
    console.log(JSON.stringify({ evt: 'referral_rewards_run', ...summary, apple: apple !== null }));
    return json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${FN}] run failed: ${message}`);
    return json({ error: 'run_failed' }, 500);
  }
});
