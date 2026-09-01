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
import { logAudit, getClientIp } from '../_shared/audit.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_KEY');

/** Image model. Env-overridable so the model can change without a redeploy. */
const IMAGE_MODEL = Deno.env.get('AVATAR_IMAGE_MODEL') ?? 'gpt-image-2';

const BUCKET = 'avatars';

/** Tiers with an ongoing daily allowance. `starter` gets one free, once. */
const PAID_TIERS: PlanTier[] = ['basic', 'premium', 'vip'];

/**
 * Source photos are downscaled client-side to 1024px before upload, which
 * lands well under 2MB of base64. The cap is generous headroom, not a target —
 * it exists so a malicious caller can't push a 50MB body through the model.
 */
const MAX_IMAGE_BASE64_BYTES = 8 * 1024 * 1024;

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

/** Image generation is slow; cap it below the platform wall-clock limit. */
const GENERATION_TIMEOUT_MS = 120_000;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Decode base64 to bytes without building an intermediate giant string copy. */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
    const dailyLimit = getPlanLimits(tier).dailyAvatarGenerations;
    const { data: quotaOk, error: quotaErr } = await supabase.rpc('consume_daily_quota', {
      p_user_id: userId,
      p_counter: 'avatars_generated',
      p_limit: dailyLimit,
    });
    if (quotaErr) {
      // Fail closed — broken quota accounting must not hand out unmetered
      // image generations, which cost real money per call.
      console.error('[generate-avatar] consume_daily_quota failed:', quotaErr.message);
      return json({ error: 'Could not verify your daily limit. Try again shortly.' }, 503);
    }
    if (quotaOk !== true) {
      return json(
        {
          error: `You've used all ${dailyLimit} avatar generations for today.`,
          code: 'DAILY_AVATAR_LIMIT_REACHED',
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

  // ── Generate ────────────────────────────────────────────────────────────
  // The photo lives only in this buffer. It is never written anywhere.
  const photoBytes = base64ToBytes(imageBase64);

  const form = new FormData();
  form.append('model', IMAGE_MODEL);
  form.append('image', new Blob([photoBytes], { type: mimeType }), 'source.png');
  form.append('prompt', style.prompt);
  form.append('size', '1024x1024');
  // 'high', deliberately, paired with a hard 1/day cap.
  //
  // This is a considered reversal of the 2026-08-31 cut to 'medium'. That
  // change optimised the wrong variable: it made every avatar cheaper but
  // left the door open to several a day, which is backwards for what this
  // feature actually is. Nobody wants four mediocre portraits; they want one
  // good one. Quality is the product here, quantity is the cost.
  //
  // The price is real and worth stating plainly: ~$0.211 per image at 1024px
  // 'high' against ~$0.053 at 'medium' (verified 2026-08-31). At one a day
  // that is ~$6.33/month of worst-case cost, which on the $9.99 basic tier is
  // most of the net revenue — so the 1/day cap is not a nicety, it is the
  // only thing making this affordable. Do not raise the cap without
  // re-pricing the tier.
  form.append('quality', 'high');
  form.append('n', '1');
  form.append('output_format', 'png');
  // `auto` is the stricter setting. This ships to students, so we keep the
  // provider's default moderation rather than relaxing it to 'low'.
  form.append('moderation', 'auto');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

  let generatedBase64: string;
  try {
    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // Never echo the provider body to the client — it can quote the prompt.
      console.error(`[generate-avatar] image API ${res.status}:`, detail.slice(0, 500));
      if (res.status === 400) {
        return json(
          {
            error: "That photo couldn't be used. Try a clear, well-lit photo of your face.",
            code: 'IMAGE_REJECTED',
          },
          400
        );
      }
      return json({ error: 'Avatar generation failed. Please try again.' }, 502);
    }

    const payload = await res.json();
    const b64 = payload?.data?.[0]?.b64_json;
    if (typeof b64 !== 'string' || !b64) {
      console.error('[generate-avatar] image API returned no b64_json');
      return json({ error: 'Avatar generation failed. Please try again.' }, 502);
    }
    generatedBase64 = b64;
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    console.error('[generate-avatar] image API call failed:', aborted ? 'timeout' : err);
    return json(
      { error: aborted ? 'Avatar generation timed out. Please try again.' : 'Avatar generation failed. Please try again.' },
      504
    );
  } finally {
    clearTimeout(timeout);
  }

  // ── Store and attach ────────────────────────────────────────────────────
  // Path is `<user_id>/...` so the storage RLS policy in migration 067
  // (owner = first path segment) grants read to exactly this user.
  const path = `${userId}/${styleKey}_${Date.now()}.png`;
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(path, base64ToBytes(generatedBase64), { contentType: 'image/png', upsert: true });

  if (upload.error) {
    console.error('[generate-avatar] upload failed:', upload.error.message);
    return json({ error: 'Could not save your new avatar. Please try again.' }, 500);
  }

  const { error: profileErr } = await supabase
    .from('user_profiles')
    .update({
      avatar_kind: 'generated',
      avatar_image_path: path,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (profileErr) {
    console.error('[generate-avatar] profile update failed:', profileErr.message);
    // Roll back the orphaned object rather than leaving storage inconsistent.
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    return json({ error: 'Could not save your new avatar. Please try again.' }, 500);
  }

  // ── Spend the free grant ────────────────────────────────────────────────
  // Only now, with an image generated, stored, and attached to the profile.
  // The RPC is atomic and one-shot (migration 077), so this is what makes the
  // second free request fail the check above.
  //
  // A failure here is logged, not surfaced: the learner has their avatar and
  // must not be told otherwise. What it costs is one un-spent grant, bounded
  // by the burst limit — the same trade as claiming it late in the first place.
  if (usingFreeGrant) {
    const { data: claimed, error: claimErr } = await supabase.rpc('consume_free_avatar', {
      p_user_id: userId,
    });
    if (claimErr) {
      console.error('[generate-avatar] consume_free_avatar failed:', claimErr.message);
    } else if (claimed !== true) {
      // Lost a race with a concurrent request inside the burst window. Both
      // callers got an image; only one grant existed. Worth knowing about if
      // it stops being rare.
      console.warn('[generate-avatar] free grant already spent for', userId);
    }
  }

  // Prune superseded generations. Best-effort: a failure here costs storage,
  // not correctness, so it must not fail the request.
  try {
    const { data: existing } = await supabase.storage.from(BUCKET).list(userId);
    const stale = (existing ?? [])
      .map((o: { name: string }) => `${userId}/${o.name}`)
      .filter((p: string) => p !== path);
    if (stale.length > 0) await supabase.storage.from(BUCKET).remove(stale);
  } catch (err) {
    console.warn('[generate-avatar] prune of previous avatars failed:', err);
  }

  await logAudit(supabase, {
    actorId: userId,
    action: 'update',
    resourceType: 'avatar',
    resourceId: path,
    // Deliberately records the style and model, never the source photo.
    metadata: { styleKey, model: IMAGE_MODEL, tier, freeGrant: usingFreeGrant },
    ipAddress: getClientIp(req),
  });

  return json({ path, styleKey }, 200);
});
