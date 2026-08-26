// Supabase Edge Function: daily-news-audio-cron (service-role only)
//
// Fired by pg_cron at 09:20 and 10:20 UTC — 20 minutes behind
// daily-news-cron, so today's article rows exist before we go looking for
// text to narrate. Renders each pending article to MP3 in the private
// `news-audio` bucket, then sweeps objects older than 30 days.
//
// A SEPARATE job and function rather than a step inside daily-news-cron.
// That job already runs 90–120s, and more importantly a fish.audio outage
// must never be able to stop the ARTICLES from being written. Text is the
// product; audio is an enhancement, and enhancements do not get to take the
// product down.
//
// Auth: validated inside the function body by comparing the Authorization
// bearer against the Vault-held cron secret — the same mechanism as
// daily-news-cron, not the platform JWT gate. Registered with
// verify_jwt = false in config.toml for that reason.
//
// No content-safety pass, deliberately: the narration script is built only
// from the persisted `daily_news` row, which already passed
// generateValidated's safety + CEFR pipeline. See ../news-audio/script.ts.
//
// Deploy: npx supabase functions deploy daily-news-audio-cron

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import {
  NARRATOR_COVERAGE,
  NEWS_AUDIO_BUCKET,
  renderNewsAudio,
  type NewsRow,
} from '../news-audio/synth.ts';
import { planQueue, reconcile, type SkippedCandidate } from './queue.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** How many articles render at once. Matches daily-news-cron's batch size:
 *  enough to finish 18 renders inside the function's wall clock, low enough
 *  not to trip a provider's concurrency ceiling. */
const RENDER_CONCURRENCY = 3;

/** A learner counts as active if their profile was touched in this window.
 *  `updated_at` moves on essentially any app interaction, so this is a
 *  cheap proxy for "someone would actually hear this". */
const ACTIVE_LEARNER_DAYS = 30;

/** Useful life of a news narration. Yesterday's news is not listened to;
 *  what this bound really protects against is 18 objects/day at ~1 MB
 *  accumulating to ~6.5 GB a year of storage nobody reads. */
const AUDIO_RETENTION_DAYS = 30;

/** Reclaim window for a `generating` claim left behind by a dead render.
 *  Must match the value in ../news-audio/index.ts. */
const CLAIM_STALE_MINUTES = 5;

/** Cap on the profile scan. `user_profiles` is user-growable, so this query
 *  is bounded per CLAUDE.md §4 — and the answer we want is a set of at most
 *  nine language codes, which any sane sample already contains. */
const ACTIVE_LANGUAGE_SCAN_LIMIT = 2000;

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Languages with at least one recently-active learner.
 *
 *  This is the difference between rendering 18 articles a day and rendering
 *  the two anyone will hear. Returns an empty set when the scan fails, and
 *  the caller treats that as "render nothing" — a cron that cannot tell who
 *  is listening should not go spend money guessing. */
// deno-lint-ignore no-explicit-any
async function activeLanguages(supabase: any): Promise<Set<string>> {
  const since = new Date(Date.now() - ACTIVE_LEARNER_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('target_language')
    .not('target_language', 'is', null)
    .gt('updated_at', since)
    .limit(ACTIVE_LANGUAGE_SCAN_LIMIT);

  if (error) {
    console.error('[daily-news-audio-cron] active-language scan failed:', error.message);
    return new Set();
  }
  return new Set(
    (data ?? [])
      .map((r: { target_language: string | null }) => r.target_language)
      .filter((l: string | null): l is string => typeof l === 'string' && l.length > 0),
  );
}

/**
 * Delete narrations older than the retention window.
 *
 * The bucket is laid out as `YYYY-MM-DD/<article-id>.mp3` precisely so this
 * can work at day granularity: list the top level, decide per folder, delete
 * its contents. The alternative — a flat bucket — means paging every object
 * ever written and reading its created_at, forever.
 *
 * Best-effort and never throws: a failed sweep must not fail the render run
 * that preceded it. It does log, because a silently-failing sweep is the
 * failure mode that turns into a storage bill nobody predicted.
 */
// deno-lint-ignore no-explicit-any
async function sweepOldAudio(supabase: any): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;
  const cutoff = new Date(Date.now() - AUDIO_RETENTION_DAYS * 86_400_000)
    .toISOString()
    .split('T')[0];

  const { data: folders, error: listError } = await supabase.storage
    .from(NEWS_AUDIO_BUCKET)
    .list('', { limit: 1000 });

  if (listError) {
    console.error('[daily-news-audio-cron] sweep list failed:', listError.message);
    return { deleted: 0, errors: 1 };
  }

  for (const folder of folders ?? []) {
    const name = folder.name as string;
    // Only names that are a date, and only dates past the cutoff. Anything
    // unrecognised is left alone — a sweep that deletes what it does not
    // understand is how you lose data you meant to keep.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(name) || name >= cutoff) continue;

    const { data: objects, error: innerError } = await supabase.storage
      .from(NEWS_AUDIO_BUCKET)
      .list(name, { limit: 1000 });
    if (innerError) {
      console.error(`[daily-news-audio-cron] sweep list ${name} failed:`, innerError.message);
      errors += 1;
      continue;
    }

    const paths = (objects ?? []).map((o: { name: string }) => `${name}/${o.name}`);
    if (paths.length === 0) continue;

    const { error: removeError } = await supabase.storage.from(NEWS_AUDIO_BUCKET).remove(paths);
    if (removeError) {
      console.error(`[daily-news-audio-cron] sweep remove ${name} failed:`, removeError.message);
      errors += 1;
      continue;
    }
    deleted += paths.length;

    // Clear the pointers too. A row claiming `ready` while its object is
    // gone is exactly the state that makes the player show a dead play
    // button; news-audio recovers from it, but it should not have to.
    //
    // Targeted by `audio_path IN (the paths just deleted)`, NOT by date.
    // Matching on the date would also null `audio_status` on rows that never
    // had audio at all — silently converting a still-renderable article into
    // the NULL back-catalogue marker, which the queue query deliberately
    // excludes. That article would then never be rendered and nothing would
    // report it. Narrowing to the exact objects removed makes that class of
    // mistake unreachable.
    //
    // `.in()` and `.not()` both filter correctly on a PostgREST mutation —
    // verified directly against this project (1 of 18 rows matched). Only
    // LOGICAL operators (`or=`) are broken on mutations; see the note on
    // claim_news_audio in migration 079.
    const { error: clearError } = await supabase
      .from('daily_news')
      .update({ audio_path: null, audio_status: null })
      .in('audio_path', paths);
    if (clearError) {
      console.error(`[daily-news-audio-cron] sweep row clear ${name} failed:`, clearError.message);
      errors += 1;
    }
  }

  return { deleted, errors };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const startedAt = Date.now();
  const today = todayUTC();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Cron-shared-secret auth ───────────────────────────────────────
  // Copied verbatim from daily-news-cron. The secret lives ONLY in Vault
  // (migration 020 + the get_cron_secret RPC); both pg_cron and this
  // function read the same value, so there is no separate env var to drift.
  const { data: secretData, error: secretErr } = await supabase.rpc('get_cron_secret');
  if (secretErr || !secretData) {
    return json({ error: 'Cron secret unavailable — Vault entry missing' }, 500);
  }
  const cronSecret = secretData as string;

  if (!cronSecret || cronSecret.length < 16) {
    console.error('[SECURITY] CRON_SECRET is missing or too short. Set a 32+ byte random value in Vault.');
    return json({ error: 'Cron secret is not configured securely' }, 500);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const providedKey = authHeader.replace(/^Bearer\s+/i, '');

  // Constant-time comparison to prevent timing attacks. The length check is
  // not constant-time and does not need to be — the secret's length is not
  // the secret.
  if (!providedKey || providedKey.length !== cronSecret.length) {
    return json({ error: 'Unauthorized — cron invocation only' }, 401);
  }
  const encoder = new TextEncoder();
  const a = encoder.encode(providedKey);
  const b = encoder.encode(cronSecret);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i];
  }
  if (mismatch !== 0) {
    return json({ error: 'Unauthorized — cron invocation only' }, 401);
  }

  // ── Build the render queue ────────────────────────────────────────
  const languages = activeLanguages(supabase);
  // Used only to pre-filter the queue below. The claim itself re-checks
  // staleness inside claim_news_audio, under the row lock — this is a way to
  // avoid attempting claims we can already see we would lose, not the
  // authority on whether a claim is stale.
  const staleBefore = new Date(Date.now() - CLAIM_STALE_MINUTES * 60_000).toISOString();

  // 'pending' and 'failed' are both retryable; a stale 'generating' is a
  // render that died and is reclaimed below. NULL is excluded on purpose —
  // that is the back-catalogue marker (migration 079), and enlisting it
  // would render 126 days of history nobody asked for.
  const { data: queue, error: queueError } = await supabase
    .from('daily_news')
    .select('id, date, language, title, summary, content, audio_status, audio_generated_at')
    .eq('date', today)
    .in('audio_status', ['pending', 'generating', 'failed'])
    .limit(100);

  if (queueError) {
    return json({ error: `Failed to read the render queue: ${queueError.message}` }, 500);
  }

  const activeSet = await languages;
  type QueueRow = NewsRow & { audio_status: string; audio_generated_at: string | null };
  const candidates = (queue ?? []) as QueueRow[];
  const plan = planQueue(candidates, activeSet, staleBefore);
  const pending = plan.attempt as QueueRow[];

  // `queued` is the number every outcome must add up to. Reported in the
  // response so a row that falls out of the queue cannot do so silently —
  // see reconcile() in ./queue.ts for why that matters more than it looks.
  const queued = candidates.length;
  let rendered = 0;
  let skipped = plan.skipped.length;
  let failed = 0;
  const failures: { id: string; language: string; error: string }[] = [];
  const skips: SkippedCandidate[] = [...plan.skipped];

  const processOne = async (row: QueueRow): Promise<void> => {
    // Same atomic claim as the lazy path in ../news-audio/index.ts: the
    // predicate re-evaluates under the row lock, so the 10:20 fire cannot
    // start a second render of something 09:20 is still working on.
    const { data: claimed, error: claimError } = await supabase.rpc('claim_news_audio', {
      p_article_id: row.id,
      p_stale_minutes: CLAIM_STALE_MINUTES,
    });

    if (claimError) {
      failed += 1;
      failures.push({ id: row.id, language: row.language, error: claimError.message });
      return;
    }
    if (claimed !== true) {
      // Lost the race to the other cron fire or a lazy listener. Recorded
      // with a reason rather than folded into a bare count.
      skipped += 1;
      skips.push({
        id: row.id,
        language: row.language,
        reason: 'claim-held-by-another-runner',
      });
      return;
    }

    try {
      await renderNewsAudio(supabase, row);
      rendered += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ id: row.id, language: row.language, error: message });
      const { error: markError } = await supabase
        .from('daily_news')
        .update({ audio_status: 'failed' })
        .eq('id', row.id);
      if (markError) {
        console.error('[daily-news-audio-cron] could not mark row failed:', markError.message);
      }
    }
  };

  // processOne never rejects — every error is recorded in `failures` — but
  // allSettled guarantees one bad promise cannot kill the whole run.
  for (let i = 0; i < pending.length; i += RENDER_CONCURRENCY) {
    await Promise.allSettled(pending.slice(i, i + RENDER_CONCURRENCY).map(processOne));
  }

  const sweep = await sweepOldAudio(supabase);

  // Every queued row must have reached exactly one outcome. If not, say so
  // in the response rather than returning a plausible-looking 200 — a row
  // that falls out of the queue is an article that is never narrated, and
  // nothing else anywhere would report it.
  const { balanced, unaccounted } = reconcile({ queued, rendered, skipped, failed });
  if (!balanced) {
    console.error(
      `[daily-news-audio-cron] ACCOUNTING MISMATCH — ${queued} row(s) queued but ${rendered + skipped + failed} accounted for (${unaccounted} unaccounted). Some article was neither rendered, skipped, nor failed.`,
    );
  }

  const durationMs = Date.now() - startedAt;
  const summary = {
    fn: 'daily-news-audio-cron',
    date: today,
    activeLanguages: [...activeSet].sort(),
    // Which provider each publishable language WOULD narrate on, regardless
    // of whether it was queued today. Providers only, never voice ids.
    // Any language reading 'elevenlabs' is currently a language whose
    // podcast fails, because the prod ELEVENLABS_KEY is an API key ID.
    voiceCoverage: NARRATOR_COVERAGE,
    queued,
    rendered,
    skipped,
    failed,
    unaccounted,
    balanced,
    swept: sweep.deleted,
    sweepErrors: sweep.errors,
    durationMs,
    skips,
    failures,
  };
  console.log(JSON.stringify(summary));

  return json(summary);
});
