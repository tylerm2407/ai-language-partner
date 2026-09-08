// The slow half of generate-avatar: the provider call, storage, and the job
// row. Split from index.ts so the request handler stays readable and each
// file stays under the 500-line rule. Nothing here runs before the 202 has
// been sent, so every outcome is written to `avatar_jobs`, never returned.
//
// PRIVACY CONTRACT (restated from index.ts): the source photo exists only as
// the in-memory buffer decoded below. It is never written to storage, never
// written to a table, and never logged.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logAudit, getClientIp } from '../_shared/audit.ts';
import type { PlanTier } from '../_shared/plan-limits.ts';

export const OPENAI_API_KEY = Deno.env.get('OPENAI_KEY');

/** Image model. Env-overridable so the model can change without a redeploy. */
const IMAGE_MODEL = Deno.env.get('AVATAR_IMAGE_MODEL') ?? 'gpt-image-2';

const BUCKET = 'avatars';

/**
 * Provider call ceiling. The Pro plan's wall clock is 400s from the START of
 * the request, and the upload + profile write after the render need a few
 * seconds of that, so this leaves ~90s of headroom. gpt-image-2 'high' has
 * been observed at 100–235s; anything past this is a hung call, not a slow one.
 */
const GENERATION_TIMEOUT_MS = 300_000;

/**
 * How many generated portraits a learner keeps. Paid plans allow a handful of
 * renders a month, so a year of steady use stays inside this; at ~1.4MB each
 * the ceiling is ~17MB per account, which is the price of never deleting a
 * portrait someone might want back.
 */
const KEEP_GENERATED_AVATARS = 12;

/**
 * Supabase's edge runtime exposes EdgeRuntime.waitUntil to keep the instance
 * alive after the response is sent. It is absent under plain `deno test`, so
 * the fallback just lets the promise run detached.
 */
export function runInBackground(task: Promise<unknown>): void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } })
    .EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(task);
}


/** Decode base64 to bytes without building an intermediate giant string copy. */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface RenderArgs {
  supabase: SupabaseClient;
  req: Request;
  userId: string;
  jobId: string;
  styleKey: string;
  prompt: string;
  imageBase64: string;
  mimeType: string;
  tier: PlanTier;
  usingFreeGrant: boolean;
}

/**
 * Settle a job as failed and, for a paid caller, hand back the monthly slot.
 *
 * The slot is consumed BEFORE the render (index.ts), because that is the only
 * order that cannot hand out unmetered images. The cost of that order is that
 * a provider timeout or a rejected photo would otherwise burn one of three
 * monthly generations on a portrait the learner never got — which is exactly
 * what happened on 2026-09-08 — so every failure path refunds here. The free
 * grant needs no refund: it is spent only after success (migration 077).
 */
export async function failJob(
  supabase: SupabaseClient,
  job: { jobId: string; userId: string; refundMonthlySlot: boolean },
  code: string,
  message: string
): Promise<void> {
  const { error } = await supabase
    .from('avatar_jobs')
    .update({
      status: 'failed',
      error_code: code,
      error_message: message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.jobId);
  if (error) console.error('[generate-avatar] could not mark job failed:', error.message);

  if (job.refundMonthlySlot) {
    const { error: refundErr } = await supabase.rpc('refund_monthly_quota', {
      p_user_id: job.userId,
      p_counter: 'avatars_generated',
      p_amount: 1,
    });
    if (refundErr) {
      console.error('[generate-avatar] refund_monthly_quota failed:', refundErr.message);
    }
  }
}

/**
 * The slow half. Runs after the 202 has gone out, so nothing here can be
 * returned to the caller — every outcome is written to the job row instead.
 * The learner-facing messages are the same ones the synchronous response used
 * to carry; the client shows error_message verbatim.
 */
export async function renderAvatar(args: RenderArgs): Promise<void> {
  const { supabase, req, userId, jobId, styleKey, prompt, imageBase64, mimeType, tier, usingFreeGrant } =
    args;
  const job = { jobId, userId, refundMonthlySlot: !usingFreeGrant };

  // The photo lives only in this buffer. It is never written anywhere.
  const photoBytes = base64ToBytes(imageBase64);

  const form = new FormData();
  form.append('model', IMAGE_MODEL);
  form.append('image', new Blob([photoBytes.buffer as ArrayBuffer], { type: mimeType }), 'source.png');
  form.append('prompt', prompt);
  form.append('size', '1024x1024');
  // 'high', deliberately, paired with a hard monthly cap.
  //
  // This is a considered reversal of the 2026-08-31 cut to 'medium'. That
  // change optimised the wrong variable: it made every avatar cheaper but
  // left the door open to several a day, which is backwards for what this
  // feature actually is. Nobody wants four mediocre portraits; they want one
  // good one. Quality is the product here, quantity is the cost.
  //
  // The price is real and worth stating plainly: ~$0.211 per image at 1024px
  // 'high' against ~$0.053 at 'medium' (verified 2026-08-31). The monthly
  // cap (migration 105) is not a nicety, it is the only thing making this
  // affordable. Do not raise the cap without re-pricing the tier.
  //
  // 'high' is also why this runs as a job: it takes minutes, not seconds.
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
        await failJob(supabase, job,
          'IMAGE_REJECTED',
          "That photo couldn't be used. Try a clear, well-lit photo of your face."
        );
        return;
      }
      await failJob(supabase, job, 'GENERATION_FAILED', 'Avatar generation failed. Please try again.');
      return;
    }

    const payload = await res.json();
    const b64 = payload?.data?.[0]?.b64_json;
    if (typeof b64 !== 'string' || !b64) {
      console.error('[generate-avatar] image API returned no b64_json');
      await failJob(supabase, job, 'GENERATION_FAILED', 'Avatar generation failed. Please try again.');
      return;
    }
    generatedBase64 = b64;
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    console.error('[generate-avatar] image API call failed:', aborted ? 'timeout' : err);
    await failJob(supabase, job,
      aborted ? 'GENERATION_TIMEOUT' : 'GENERATION_FAILED',
      aborted
        ? 'Avatar generation timed out. Please try again.'
        : 'Avatar generation failed. Please try again.'
    );
    return;
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
    await failJob(supabase, job, 'SAVE_FAILED', 'Could not save your new avatar. Please try again.');
    return;
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
    await failJob(supabase, job, 'SAVE_FAILED', 'Could not save your new avatar. Please try again.');
    return;
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

  // Settle the job BEFORE the housekeeping below: the learner is waiting on
  // this row, and a slow storage listing must not hold the spinner.
  const { error: doneErr } = await supabase
    .from('avatar_jobs')
    .update({ status: 'done', avatar_path: path, updated_at: new Date().toISOString() })
    .eq('id', jobId);
  if (doneErr) {
    // The avatar IS attached to the profile; only the poll signal is lost.
    console.error('[generate-avatar] could not mark job done:', doneErr.message);
  }

  // Keep the learner's recent generations as a gallery they can switch back
  // to (the client lists this folder — `listGeneratedAvatars`), and prune only
  // past the cap. This used to delete every object but the newest, which meant
  // choosing a preset and then regenerating lost the previous portrait for
  // good; each one cost a paid render. Best-effort: a failure here costs
  // storage, not correctness, so it must not fail the request.
  try {
    const { data: existing } = await supabase.storage.from(BUCKET).list(userId, {
      limit: 200,
      sortBy: { column: 'created_at', order: 'desc' },
    });
    const stale = (existing ?? [])
      .map((o: { name: string }) => `${userId}/${o.name}`)
      .filter((p: string) => p !== path)
      .slice(KEEP_GENERATED_AVATARS - 1);
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
    metadata: { styleKey, model: IMAGE_MODEL, tier, freeGrant: usingFreeGrant, jobId },
    ipAddress: getClientIp(req),
  });
}
