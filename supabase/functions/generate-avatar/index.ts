// Supabase Edge Function: photo-to-avatar generation
//
// Takes a selfie, renders it in one of the hidden art-direction prompts from
// `_shared/avatar-styles.ts`, stores the result in the private `avatars`
// bucket (migration 067), and points the caller's profile at it.
//
// PRIVACY CONTRACT — the source photo is never persisted. It exists only as
// an in-memory buffer for the duration of this request: it is not written to
// storage, not written to any table, and never logged. Only the generated
// image survives the request. Account deletion purges that via delete-account.
//
// ASYNC, since 2026-09-08. gpt-image-2 at quality 'high' takes 100–235s for
// a 1024px edit — longer than the client's 60s function budget and longer than
// the 120s this function used to allow the provider. Every 'high' render died
// twice: the phone gave up at 60s ("Failed to send a request to the Edge
// Function") and this function aborted at 120s ("image API call failed:
// timeout"). So the request now returns a job id as soon as entitlement
// clears, the render runs in EdgeRuntime.waitUntil inside the Pro plan's 400s
// wall clock, and the client polls `avatar_jobs` (migration 112) under RLS.
//
// Paid tiers, plus ONE lifetime free generation per account — and that check
// happens HERE rather than in the client (CLAUDE.md §1.2), because the
// function is directly invokable by any signed-in user. The free grant is a
// row-level flag spent atomically by consume_free_avatar (migration 077); a
// client cannot see it, set it, or ask twice.
//
// Secrets: OPENAI_KEY (required, shared with transcribe / score-pronunciation),
//          AVATAR_IMAGE_MODEL (optional).
//
// Deploy: npx supabase functions deploy generate-avatar

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { getPlanLimits, type PlanTier } from '../_shared/plan-limits.ts';
import { getAvatarStyle, listAvatarStyles } from '../_shared/avatar-styles.ts';
import { OPENAI_API_KEY, renderAvatar, failJob, runInBackground } from './render.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Tiers with an ongoing daily allowance. `starter` gets one free, once. */
const PAID_TIERS: PlanTier[] = ['basic', 'premium', 'vip'];

/**
 * Source photos are downscaled client-side to 1024px before upload, which
 * lands well under 2MB of base64. The cap is generous headroom, not a target —
 * it exists so a malicious caller can't push a 50MB body through the model.
 */
const MAX_IMAGE_BASE64_BYTES = 8 * 1024 * 1024;

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

/** Jobs older than this are pruned when the same user starts a new one. */
const JOB_RETENTION_MS = 24 * 60 * 60 * 1000;

/** The client polls at most this long, so anything still pending after it is dead. */
const JOB_STALE_MS = 10 * 60 * 1000;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface GenerateAvatarRequest {
  /** 'styles' lists the catalogue and returns; absent means "generate". */
  action?: unknown;
  styleKey?: unknown;
  imageBase64?: unknown;
  mimeType?: unknown;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  if (!OPENAI_API_KEY) {
    console.error('[generate-avatar] OPENAI_KEY not configured');
    return json({ error: 'Avatar generation is not configured.', code: 'NOT_CONFIGURED' }, 500);
  }

  const auth = await getAuthenticatedUser(req).catch(() => null);
  if (!auth) {
    return json({ error: 'Invalid or missing authorization token' }, 401);
  }
  const { userId } = auth;

  // ── Input validation ────────────────────────────────────────────────────
  let body: GenerateAvatarRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }

  // ── Style catalogue ─────────────────────────────────────────────────────
  // The picker asks the server what styles exist rather than shipping its own
  // copy. Adding a style to _shared/avatar-styles.ts then reaches every
  // installed client without an app release — and, more importantly, without
  // the client list silently drifting out of date and hiding a style that the
  // server would happily render.
  //
  // Only labels and descriptions cross the wire. The prompts are the product's
  // art direction and never leave the server (CLAUDE.md §6) — listAvatarStyles
  // strips them, and avatar-styles.test.ts asserts that it does.
  //
  // Behind auth deliberately: this returns nothing sensitive, but an
  // unauthenticated branch here would be a free, uncounted endpoint on a
  // function that otherwise costs money to call.
  if (body.action === 'styles') {
    return json({ styles: listAvatarStyles() }, 200);
  }

  const styleKey = typeof body.styleKey === 'string' ? body.styleKey : '';
  const style = getAvatarStyle(styleKey);
  if (!style) {
    return json({ error: 'Unknown avatar style.', code: 'INVALID_STYLE' }, 400);
  }

  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
  if (!imageBase64) {
    return json({ error: 'A photo is required.', code: 'MISSING_IMAGE' }, 400);
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_BYTES) {
    return json({ error: 'That photo is too large. Try a smaller one.', code: 'IMAGE_TOO_LARGE' }, 413);
  }

  const mimeType = typeof body.mimeType === 'string' && ACCEPTED_MIME.includes(body.mimeType)
    ? body.mimeType
    : 'image/jpeg';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Entitlement: paid tiers only, enforced server-side ──────────────────
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, is_active')
    .eq('user_id', userId)
    .maybeSingle();

  const tier: PlanTier = (sub?.is_active && sub.tier ? sub.tier : 'starter') as PlanTier;
  const isPaid = PAID_TIERS.includes(tier);

  // ── Abuse control ───────────────────────────────────────────────────────
  // Ahead of the entitlement branch on purpose: an unentitled caller hammering
  // this endpoint still costs database work, and the free-grant path below
  // leans on this bound to keep its check-then-generate window narrow.
  const withinBurst = await checkBurstLimit(supabase, userId, 'generate-avatar', 3, 300);
  if (!withinBurst) {
    return json(
      { error: 'Too many avatar requests. Please wait a moment.', code: 'RATE_LIMITED' },
      429
    );
  }

  /**
   * Set when this request is running on the account's one lifetime free
   * generation, so the success path knows to spend it.
   *
   * The flag is claimed AFTER the image comes back, not here. Claiming it up
   * front would burn a learner's single free avatar on our 502, on a provider
   * timeout, or on a photo the moderator rejected — the three failures most
   * likely to make someone try again. The cost of waiting is a window in which
   * a caller could get two images before the flag lands; the burst limit above
   * bounds that at three requests per five minutes, which is a far better
   * trade than charging people for our own outages.
   */
  const usingFreeGrant = !isPaid;

  if (isPaid) {
    // MONTHLY, not daily (migration 105). A daily cap was the wrong shape for
    // this feature: at ~$0.211 an image, 1/day is ~$6.33/user/month — 75% of
    // net revenue on basic — to serve a behaviour nobody has. Someone setting
    // up a profile wants two or three attempts in one sitting and then nothing
    // for months. 3/month serves that better AND costs ten times less.
    const monthlyLimit = getPlanLimits(tier).monthlyAvatarGenerations;
    const { data: quotaOk, error: quotaErr } = await supabase.rpc('consume_monthly_quota', {
      p_user_id: userId,
      p_counter: 'avatars_generated',
      p_limit: monthlyLimit,
    });
    if (quotaErr) {
      // Fail closed — broken quota accounting must not hand out unmetered
      // image generations, which cost real money per call.
      console.error('[generate-avatar] consume_monthly_quota failed:', quotaErr.message);
      return json({ error: 'Could not verify your limit. Try again shortly.' }, 503);
    }
    if (quotaOk !== true) {
      return json(
        {
          error: `You've used all ${monthlyLimit} avatar generations for this month.`,
          code: 'MONTHLY_AVATAR_LIMIT_REACHED',
        },
        429
      );
    }
  } else {
    // Free tier: allowed exactly once, ever. Read the flag without spending it
    // so a failed generation stays retryable, and refuse early when it is
    // already gone — that is the whole point of checking before we pay a
    // provider for an image this caller is not entitled to.
    const { data: profile, error: profileErr } = await supabase
      .from('user_profiles')
      .select('free_avatar_used_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileErr) {
      // Fail closed for the same reason as the quota branch above.
      console.error('[generate-avatar] free-grant lookup failed:', profileErr.message);
      return json({ error: 'Could not verify your plan. Try again shortly.' }, 503);
    }
    if (!profile || profile.free_avatar_used_at !== null) {
      return json(
        {
          error: "You've used your free avatar. More are included with a paid plan.",
          code: 'AVATAR_REQUIRES_PLAN',
        },
        403
      );
    }
  }

  // ── Create the job, answer, render in the background ────────────────────
  // Entitlement is settled above, synchronously, so a refused caller still
  // gets the real reason (AVATAR_REQUIRES_PLAN, MONTHLY_AVATAR_LIMIT_REACHED)
  // as an HTTP status. Only the slow part moves off the request.
  //
  // Housekeeping first: a stuck 'pending' row from a previous instance that
  // hit the wall clock is marked failed so the client never polls it, and
  // settled rows past retention go. Best-effort — a failure here must not
  // block a generation the caller is entitled to.
  const now = Date.now();
  await supabase
    .from('avatar_jobs')
    .update({
      status: 'failed',
      error_code: 'GENERATION_TIMEOUT',
      error_message: 'Avatar generation timed out. Please try again.',
      updated_at: new Date(now).toISOString(),
    })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lt('created_at', new Date(now - JOB_STALE_MS).toISOString())
    .then(({ error }) => {
      if (error) console.warn('[generate-avatar] stale job sweep failed:', error.message);
    });
  await supabase
    .from('avatar_jobs')
    .delete()
    .eq('user_id', userId)
    .lt('created_at', new Date(now - JOB_RETENTION_MS).toISOString())
    .then(({ error }) => {
      if (error) console.warn('[generate-avatar] job prune failed:', error.message);
    });

  const { data: job, error: jobErr } = await supabase
    .from('avatar_jobs')
    .insert({ user_id: userId, style_key: styleKey, status: 'pending' })
    .select('id')
    .single();
  if (jobErr || !job?.id) {
    console.error('[generate-avatar] job insert failed:', jobErr?.message);
    return json({ error: 'Could not start your avatar. Try again shortly.' }, 503);
  }
  const jobId = job.id as string;

  runInBackground(
    renderAvatar({
      supabase,
      req,
      userId,
      jobId,
      styleKey,
      prompt: style.prompt,
      imageBase64,
      mimeType,
      tier,
      usingFreeGrant,
    }).catch(async (err: unknown) => {
      // Last line of defence: renderAvatar settles the job on every path it
      // knows about, so reaching here means a bug, and the client must still
      // stop polling.
      console.error('[generate-avatar] render crashed:', err);
      await failJob(supabase, jobId, 'GENERATION_FAILED', 'Avatar generation failed. Please try again.');
    })
  );

  return json({ jobId, status: 'pending' }, 202);
});
