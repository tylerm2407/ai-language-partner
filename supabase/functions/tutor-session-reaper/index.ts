// Supabase Edge Function: tutor-session-reaper (service-role only)
//
// Fired by pg_cron every three minutes (migration 110). Finds live tutor
// sessions whose heartbeat has gone stale, settles them down to the last
// moment we can prove the learner was there, refunds the rest, recovers what
// the session was worth to them, and closes the row. Also sweeps
// `tutor_safety_events` past its 90-day retention window, once per run.
//
// WHY IT HAS TO EXIST: the tutor's media path is WebRTC, client-to-OpenAI
// directly, so `start` reserves the whole grant up front and the client is
// expected to call `end` for its refund. A force-killed app never calls `end`.
// Without this function that learner has paid in full for minutes they never
// used and nothing would ever give them back. See ./reap.ts for the reasoning
// in full — this file is only the shell.
//
// Auth: the Authorization bearer is compared, in constant time, against the
// Vault-held cron secret read through `get_cron_secret`. Same mechanism as
// daily-news-cron and daily-news-audio-cron, NOT the platform JWT gate, so it
// must be registered with verify_jwt = false in config.toml.
//
// Structure: every decision lives in ./reap.ts behind an injected `ReaperDeps`,
// and this file is `serve()` + auth + wiring. `serve()` at module scope is what
// makes ai-chat/index.ts untestable; keeping the logic out of here is what
// stops that from happening again.
//
// Deploy: npx supabase functions deploy tutor-session-reaper
//   (and only THEN apply the cron.schedule at the bottom of migration 110 —
//    scheduling it first just means every tick 404s until the gap closes.)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getEffectiveLimits } from '../_shared/plan-limits.ts';
import { analyzeTutorSession } from '../_shared/tutor-analysis.ts';
import { writeBackTutorSession } from '../_shared/tutor-writeback.ts';
import { recordTutorAnalysisFailure, settleTutorSession } from '../_shared/tutor-ledger.ts';
import { dropTranscript, readTranscript } from '../_shared/tutor-transcript-buffer.ts';
import type { CEFR } from '../_shared/level-checker.ts';
import {
  REAP_BATCH_LIMIT,
  reapAbandonedSessions,
  type ReapableSession,
  type ReaperDeps,
  type SettleClaim,
} from './reap.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FN = 'tutor-session-reaper';

/** Exactly the columns ./reap.ts declares in `ReapableSession`. */
const SESSION_COLUMNS = 'id, user_id, target_language, native_language, level, cefr_level, correction_mode, ' +
  'granted_seconds, granted_cents, started_at, last_heartbeat_at, observed_seconds';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * The learner's daily chat-card allowance, which `writeBackTutorSession` uses
 * as the ceiling its atomic counter checks.
 *
 * The tier is looked up and PASSED IN rather than left to default. Omitting it
 * is the documented footgun in plan-limits.ts, and here it would silently cut
 * every paying learner's recovered session down to the free tier's three
 * cards — punishing exactly the learners whose app crashed.
 */
async function chatCardLimitFor(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
): Promise<number> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  const tier = (sub?.tier as string | undefined) ?? 'starter';
  const limits = await getEffectiveLimits(userId, supabase, tier);
  return limits.dailyChatCards;
}

/**
 * Wire the real database, Redis and provider behind `ReaperDeps`.
 *
 * Each method is the thinnest possible translation of one effect. The refunds
 * REJECT on a PostgREST error rather than returning it, because reap.ts's
 * settlement path distinguishes "the refund did not land" from every other
 * failure and logs it at error level — swallowing the error here would erase
 * the one trace a learner-charged-for-nothing leaves behind.
 */
// deno-lint-ignore no-explicit-any
function buildDeps(supabase: any, anthropicKey: string): ReaperDeps {
  return {
    now: () => Date.now(),

    async listStale(cutoffIso, limit) {
      // Served by `idx_tutor_sessions_open_heartbeat`, the partial index
      // migration 107 added for exactly this query. Ordered oldest-first so a
      // batch that cannot cover everything covers the sessions that have been
      // waiting longest for their money.
      const { data, error } = await supabase
        .from('tutor_sessions')
        .select(SESSION_COLUMNS)
        .is('ended_at', null)
        .lt('last_heartbeat_at', cutoffIso)
        .order('last_heartbeat_at', { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as ReapableSession[];
    },

    async settleSession(sessionId, userId, wanted): Promise<SettleClaim> {
      try {
        const result = await settleTutorSession(supabase, {
          sessionId,
          userId,
          settlement: wanted,
        });
        return {
          status: result.status === 'already_settled' ? 'already' : 'settled',
          observedSeconds: result.observedSeconds,
        };
      } catch {
        return { status: 'error' };
      }
    },

    readTranscript: (sessionId) => readTranscript(sessionId),

    analyze: (session, turns) =>
      analyzeTutorSession({
        transcript: turns,
        targetLanguage: session.target_language,
        nativeLanguage: session.native_language,
        level: session.level,
        cefrLevel: session.cefr_level as CEFR,
        correctionMode: session.correction_mode,
        apiKey: anthropicKey,
      }),

    async writeBack(session, analysis, observedSeconds) {
      // `writeBackTutorSession` owns its own `analyzed_at` claim, so a session
      // the `end` action already handled comes back `alreadyAnalyzed: true`
      // rather than being written twice. Do not add a second guard here.
      const result = await writeBackTutorSession(supabase, {
        userId: session.user_id,
        sessionId: session.id,
        targetLanguage: session.target_language,
        nativeLanguage: session.native_language,
        level: session.level,
        cefrLevel: session.cefr_level,
        analysis,
        observedSeconds,
        chatCardLimit: await chatCardLimitFor(supabase, session.user_id),
      });
      return { alreadyAnalyzed: result.alreadyAnalyzed };
    },

    recordAnalysisFailure: (sessionId, userId, error) =>
      recordTutorAnalysisFailure(supabase, { sessionId, userId, error }),

    async closeSession(sessionId, observedSeconds) {
      // Guarded on `ended_at IS NULL` so a close can never overwrite an honest
      // `end`'s settlement with the reaper's. `observed_seconds` is restated
      // rather than trusted from the claim, so a row whose claim took the
      // fail-open path still lands correct.
      const { error } = await supabase
        .from('tutor_sessions')
        .update({
          ended_at: new Date().toISOString(),
          end_reason: 'abandoned',
          observed_seconds: observedSeconds,
        })
        .eq('id', sessionId)
        .is('ended_at', null);
      if (error) throw new Error(error.message);
    },

    dropTranscript: (sessionId) => dropTranscript(sessionId),

    async sweepSafetyEvents(cutoffIso) {
      const { data, error } = await supabase
        .from('tutor_safety_events')
        .delete()
        .lt('created_at', cutoffIso)
        .select('id');
      if (error) throw new Error(error.message);
      return Array.isArray(data) ? data.length : 0;
    },
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Cron-shared-secret auth ───────────────────────────────────────
  // Copied from daily-news-audio-cron. The secret lives ONLY in Vault
  // (migration 020 + the get_cron_secret RPC); both pg_cron and this function
  // read the same value, so there is no separate env var to drift.
  const { data: secretData, error: secretErr } = await supabase.rpc(
    'get_cron_secret',
  );
  if (secretErr || !secretData) {
    return json(
      { error: 'Cron secret unavailable — Vault entry missing' },
      500,
    );
  }
  const cronSecret = secretData as string;

  if (!cronSecret || cronSecret.length < 16) {
    console.error(
      '[SECURITY] CRON_SECRET is missing or too short. Set a 32+ byte random value in Vault.',
    );
    return json({ error: 'Cron secret is not configured securely' }, 500);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const providedKey = authHeader.replace(/^Bearer\s+/i, '');

  // Constant-time comparison to prevent timing attacks. The length check is
  // not constant-time and does not need to be — the secret's length is not the
  // secret. Nothing about the caller is logged on rejection.
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

  // ── The run ───────────────────────────────────────────────────────
  // A missing analysis key does NOT stop the tick. The money still has to move
  // — that is the half of this function a learner feels — and reporting the
  // suppressed analysis honestly is better than dressing it up as a lost
  // transcript buffer, which would send someone hunting a Redis outage that
  // never happened.
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  if (!anthropicKey) {
    console.error(
      `[${FN}] ANTHROPIC_API_KEY is not set; settling money and retaining transcripts for retry`,
    );
  }

  const summary = await reapAbandonedSessions(
    buildDeps(supabase, anthropicKey),
    {
      limit: REAP_BATCH_LIMIT,
      skipAnalysis: !anthropicKey,
    },
  );

  const elapsedMs = Date.now() - startedAt;

  // One line, every count. Atomic settlement failures remain open and are
  // retried on the next scheduled run.
  console.log(`[${FN}] ${JSON.stringify({ ...summary, elapsedMs })}`);

  return json({ ...summary, elapsedMs });
});
