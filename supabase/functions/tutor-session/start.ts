/**
 * Opening a live tutor session: reserve the money, then mint the token.
 *
 * THE ORDER IN HERE IS THE WHOLE DESIGN
 *
 * Each step is the cheapest thing that can still say no, and the reservation
 * happens BEFORE the ephemeral secret exists. Once that secret is minted the
 * learner's device talks straight to OpenAI over WebRTC and we are no longer in
 * the media path — there is no request left to meter and no connection we can
 * close. So the only moment we can refuse is now, and the only honest way to
 * bill is to charge the whole grant up front and give back what was not used.
 *
 * That inverts the incentive that makes settle-as-you-go unworkable: a client
 * that mints a token and never calls home keeps the full charge. Abandonment
 * becomes the expensive choice rather than the free one.
 *
 * The reservation is ONE database transaction (`reserve_tutor_session`,
 * migration 123): both ceilings are checked under row locks and both meters
 * move together, or nothing moves. It also refuses a second open session for
 * the same learner. The session row is inserted first so the ledger has a row
 * to lock and to remember which day and month it charged.
 *
 * The single most important error path in this file is the one after a failed
 * mint. If we have reserved and the mint then fails, the learner has been
 * charged for a session that never happened — `settle_tutor_session` with zero
 * observed seconds gives every cent back in one transaction.
 */
import { type PlanLimits } from '../_shared/plan-limits.ts';
import { resolveEntitlement } from '../_shared/entitlement.ts';
import { stashEphemeralKey } from '../_shared/tutor-calls.ts';
import { reserveTutorSession, settleTutorSession } from '../_shared/tutor-ledger.ts';
import { fetchLearnerContext, serializeLearnerContext, isEntitledToLearnerContext } from '../_shared/learner-context.ts';
import { fetchTutorMemory, serializeTutorMemory } from '../_shared/tutor-memory.ts';
import { proficiencyToCefr } from '../_shared/cefr.ts';
import { providerFetch, PROVIDER_TIMEOUT_MS } from '../_shared/provider-fetch.ts';
import {
  TUTOR_MODEL,
  TUTOR_HEARTBEAT_SECONDS,
  resolveGrant,
} from '../_shared/tutor-pricing.ts';
import { buildTutorInstructions, turnDetectionForLevel, type CorrectionMode } from './instructions.ts';
import { resolvePersona, speechSpeedForLevel } from './personas.ts';
import { selectPushStance, type PushSignal } from '../ai-chat/turn-policy.ts';

const CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets';

/** Cap on the tutor's spoken turn. Output audio is the most expensive token
 *  class in the feature, and this also enforces the learner's floor share:
 *  ~300 tokens is about fifteen seconds of speech, which is a conversational
 *  turn rather than a lecture. */
const MAX_OUTPUT_TOKENS = 300;

// deno-lint-ignore no-explicit-any
type Client = any;

export interface StartRequest {
  targetLanguage: string;
  nativeLanguage?: string;
  level: string;
  scenarioKey?: string | null;
  correctionMode: CorrectionMode;
  personaId?: string;
  requestedMinutes?: number;
}

export interface StartResult {
  status: number;
  // deno-lint-ignore no-explicit-any
  body: Record<string, any>;
}

/** Reads both meters. Returns zeros on failure rather than throwing — but note
 *  that a read failure biases toward GRANTING, so the atomic consume calls
 *  below are what actually enforce the ceilings. This is only for sizing. */
async function readMeters(
  supabase: Client,
  userId: string,
): Promise<{ tutorSecondsToday: number; tutorCentsThisMonth: number }> {
  try {
    const [{ data: day }, { data: month }] = await Promise.all([
      // NOTE the parameter names differ between these two functions:
      // fluenci_user_today takes p_uid, fluenci_user_month takes p_user_id.
      // Getting one wrong returns null and silently reads the wrong row.
      supabase.rpc('fluenci_user_today', { p_uid: userId }),
      supabase.rpc('fluenci_user_month', { p_user_id: userId }),
    ]);

    const [dayRow, monthRow] = await Promise.all([
      supabase.from('daily_usage').select('tutor_seconds').eq('user_id', userId).eq('date', day).maybeSingle(),
      supabase.from('monthly_usage').select('tutor_cents').eq('user_id', userId).eq('month', month).maybeSingle(),
    ]);

    return {
      tutorSecondsToday: Number(dayRow?.data?.tutor_seconds ?? 0) || 0,
      tutorCentsThisMonth: Number(monthRow?.data?.tutor_cents ?? 0) || 0,
    };
  } catch (err) {
    console.warn('[tutor-session] meter read failed:', err instanceof Error ? err.message : err);
    return { tutorSecondsToday: 0, tutorCentsThisMonth: 0 };
  }
}

/**
 * A salted hash of the user id for OpenAI's abuse tooling.
 *
 * Never the raw auth.users uuid and never the email: that id is a join key
 * across our entire database, and handing it to a vendor turns their logs into
 * a partial index of our users. A salted digest is stable enough for them to
 * correlate abuse from one account without being reversible or cross-referenceable.
 */
async function safetyIdentifier(userId: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${userId}:${salt}`));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Reads the recent speaking evidence that decides whether to stretch this
 *  learner. Resolved ONCE per session — unlike ai-chat, which recomputes it per
 *  turn — because the instructions are frozen for the life of the call. It
 *  already averages over a 30-turn window, so this loses very little. */
async function fetchPushSignal(
  supabase: Client,
  userId: string,
  targetLanguage: string,
  cefrLevel: string,
): Promise<PushSignal> {
  try {
    const { data } = await supabase
      .from('conversation_evidence')
      .select('accuracy, intelligibility')
      .eq('user_id', userId)
      .eq('target_language', targetLanguage)
      .eq('cefr_level', cefrLevel)
      .order('created_at', { ascending: false })
      .limit(30);
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return { sampleSize: 0, recentAccuracy: null };
    const acc = rows.map((r: { accuracy: number | null }) => Number(r.accuracy)).filter((n) => Number.isFinite(n));
    return {
      sampleSize: acc.length,
      recentAccuracy: acc.length > 0 ? acc.reduce((a, b) => a + b, 0) / acc.length : null,
    };
  } catch {
    return { sampleSize: 0, recentAccuracy: null };
  }
}

export async function handleStart(
  supabase: Client,
  userId: string,
  req: StartRequest,
  env: {
    openaiKey: string;
    safetySalt: string;
    /** Where the ephemeral key waits for `connect`. Injected for tests. */
    stashKey?: (sessionId: string, secret: string, expiresAt: number | null) => Promise<void>;
  },
): Promise<StartResult> {
  const targetLanguage = req.targetLanguage;
  const nativeLanguage = req.nativeLanguage || 'en';
  const level = req.level;
  const cefrLevel = proficiencyToCefr(level);

  // ── tier and entitlement ────────────────────────────────────────────
  // One definition of "paid" (_shared/entitlement.ts): active AND unexpired.
  // The tier is passed into the limits lookup — omitting it is the documented
  // footgun in plan-limits.ts and here it would resolve every paying learner
  // to dailyTutorMinutes: 0.
  const { tier, limits }: { tier: string; limits: PlanLimits } = await resolveEntitlement(supabase, userId);

  if (!limits.dailyTutorMinutes || limits.dailyTutorMinutes <= 0) {
    return {
      status: 403,
      body: {
        error: 'The live tutor is part of a plan.',
        code: 'TUTOR_NOT_ENTITLED',
      },
    };
  }

  // ── how long may this session run ───────────────────────────────────
  const meters = await readMeters(supabase, userId);
  const grant = resolveGrant({
    dailySecondsRemaining: limits.dailyTutorMinutes * 60 - meters.tutorSecondsToday,
    monthlyCentsRemaining: limits.monthlyTutorCents - meters.tutorCentsThisMonth,
    requestedSeconds: req.requestedMinutes ? Math.round(req.requestedMinutes * 60) : undefined,
  });

  if (grant.seconds <= 0) {
    // Distinct codes, because the copy and the reset date differ: the daily one
    // comes back tonight, the monthly one does not.
    const monthly = grant.reason === 'monthly';
    return {
      status: 429,
      body: {
        error: monthly
          ? 'You have used all your live tutor minutes this month.'
          : 'You have used your live tutor time for today.',
        code: monthly ? 'MONTHLY_TUTOR_BUDGET_REACHED' : 'DAILY_TUTOR_LIMIT_REACHED',
      },
    };
  }

  const cents = grant.cents;

  // ── assemble the instructions ───────────────────────────────────────
  const persona = resolvePersona(req.personaId);
  const [learnerCtx, memoryNotes, pushSignal] = await Promise.all([
    isEntitledToLearnerContext(tier)
      ? fetchLearnerContext(supabase, {
          userId,
          targetLanguage,
          include: ['goal', 'goal_track', 'pronunciation'],
        })
      : Promise.resolve(null),
    fetchTutorMemory(supabase, { userId, targetLanguage }),
    fetchPushSignal(supabase, userId, targetLanguage, cefrLevel),
  ]);

  const instructions = buildTutorInstructions({
    targetLanguage,
    nativeLanguage,
    level,
    cefrLevel,
    personaName: persona.name,
    scenarioKey: req.scenarioKey ?? null,
    correctionMode: req.correctionMode,
    learnerBlock: learnerCtx ? serializeLearnerContext(learnerCtx, { maxChars: 1200 }) : null,
    memoryBlock: serializeTutorMemory(memoryNotes),
    pushStance: selectPushStance(pushSignal),
  });

  // ── the session row, before the money ───────────────────────────────
  // Nothing has been charged yet, so a failure here refunds nothing.
  const { data: session, error: sessionErr } = await supabase
    .from('tutor_sessions')
    .insert({
      user_id: userId,
      target_language: targetLanguage,
      native_language: nativeLanguage,
      level,
      cefr_level: cefrLevel,
      scenario_key: req.scenarioKey ?? null,
      correction_mode: req.correctionMode,
      voice: persona.voice,
      model: TUTOR_MODEL,
      granted_seconds: grant.seconds,
      granted_cents: cents,
    })
    .select('id')
    .single();

  if (sessionErr || !session) {
    console.error('[tutor-session] session insert failed:', sessionErr?.message);
    return { status: 500, body: { error: 'Could not start a session. Please try again.', code: 'SESSION_INSERT_FAILED' } };
  }

  // ── reserve, atomically ─────────────────────────────────────────────
  // Both ceilings in one transaction. A refusal leaves no charge behind, so
  // the unreserved row is simply removed rather than closed.
  let reserved: Awaited<ReturnType<typeof reserveTutorSession>>;
  try {
    reserved = await reserveTutorSession(supabase, {
      sessionId: session.id,
      userId,
      dailyLimit: limits.dailyTutorMinutes * 60,
      monthlyLimit: limits.monthlyTutorCents,
    });
  } catch (err) {
    console.error('[tutor-session] reservation failed:', err instanceof Error ? err.message : err);
    await discardUnreserved(supabase, session.id);
    return { status: 503, body: { error: 'Could not start a session. Please try again.', code: 'RESERVATION_UNAVAILABLE' } };
  }
  if (reserved === 'monthly_limit') {
    await discardUnreserved(supabase, session.id);
    return {
      status: 429,
      body: { error: 'You have used all your live tutor minutes this month.', code: 'MONTHLY_TUTOR_BUDGET_REACHED' },
    };
  }
  if (reserved === 'daily_limit') {
    await discardUnreserved(supabase, session.id);
    return {
      status: 429,
      body: { error: 'You have used your live tutor time for today.', code: 'DAILY_TUTOR_LIMIT_REACHED' },
    };
  }
  if (reserved === 'active_session') {
    // Another call is open or not yet settled. The reaper closes abandoned
    // ones within TUTOR_REAP_AFTER_SECONDS, so this clears itself.
    await discardUnreserved(supabase, session.id);
    return {
      status: 409,
      body: { error: 'You already have a live tutor session open. End it before starting another.', code: 'TUTOR_SESSION_ACTIVE' },
    };
  }

  // ── mint ────────────────────────────────────────────────────────────
  try {
    const res = await providerFetch(
      CLIENT_SECRETS_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.openaiKey}`,
          'OpenAI-Safety-Identifier': await safetyIdentifier(userId, env.safetySalt),
        },
        body: JSON.stringify({
          session: {
            type: 'realtime',
            model: TUTOR_MODEL,
            instructions,
            audio: {
              output: { voice: persona.voice, speed: speechSpeedForLevel(level) },
              input: {
                turn_detection: turnDetectionForLevel(level),
                transcription: { model: 'whisper-1' },
              },
            },
            max_output_tokens: MAX_OUTPUT_TOKENS,
            tools: [],
          },
        }),
      },
      { provider: 'openai-realtime', timeoutMs: PROVIDER_TIMEOUT_MS.textShort },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // Never return the provider's text to the client — it can echo the
      // instructions back, which would leak the system prompt.
      console.error('[tutor-session] mint failed:', res.status, detail.slice(0, 300));
      throw new Error(`mint ${res.status}`);
    }

    const minted = await res.json();
    // The response shape has moved between API revisions; accept the secret at
    // the top level or nested, and fail loudly rather than handing the client
    // an undefined token it would spend a round trip discovering.
    const clientSecret: string | undefined = minted?.value ?? minted?.client_secret?.value;
    const expiresAt: number | undefined = minted?.expires_at ?? minted?.client_secret?.expires_at;
    if (typeof clientSecret !== 'string' || clientSecret.length === 0) {
      throw new Error('mint returned no client secret');
    }

    // The key NEVER reaches the device. It waits in Redis for the `connect`
    // action, which does the SDP exchange server-side so the resulting call
    // id is ours — see _shared/tutor-calls.ts for why that is the whole spend
    // ceiling. A stash failure is a mint failure: refund and refuse.
    await (env.stashKey ?? stashEphemeralKey)(session.id, clientSecret, typeof expiresAt === 'number' ? expiresAt : null);

    return {
      status: 200,
      body: {
        sessionId: session.id,
        model: TUTOR_MODEL,
        grantedSeconds: grant.seconds,
        heartbeatIntervalSeconds: TUTOR_HEARTBEAT_SECONDS,
        correctionMode: req.correctionMode,
        personaId: persona.id,
        remainingTutorMinutesToday: Math.max(
          0,
          Math.floor((limits.dailyTutorMinutes * 60 - meters.tutorSecondsToday - grant.seconds) / 60),
        ),
      },
    };
  } catch (err) {
    // THE important error path. We have charged for a session that will not
    // happen; give it all back and mark the row so the reaper does not later
    // try to settle a session that never opened.
    await refundEverything(supabase, userId, session.id, grant.seconds, cents, 'mint failed');
    await supabase
      .from('tutor_sessions')
      .update({ ended_at: new Date().toISOString(), end_reason: 'error' })
      .eq('id', session.id);
    console.error('[tutor-session] mint threw:', err instanceof Error ? err.message : err);
    return { status: 502, body: { error: 'The tutor is unavailable right now. Please try again.', code: 'TUTOR_UNAVAILABLE' } };
  }
}

/** Give back the whole reservation in one transaction: zero observed seconds,
 *  every second and cent refunded. Logged loudly on failure — a refund that
 *  does not land is a learner charged for nothing, and the open row is left
 *  for the reaper, which will settle it the same way. */
async function refundEverything(
  supabase: Client,
  userId: string,
  sessionId: string,
  grantedSeconds: number,
  grantedCents: number,
  why: string,
): Promise<void> {
  try {
    // Not `settlement(…, 0)`: that applies the per-second floor and would
    // keep one cent for a call that never existed. Nothing happened; nothing
    // is owed.
    await settleTutorSession(supabase, {
      sessionId,
      userId,
      settlement: { observedSeconds: 0, refundSeconds: grantedSeconds, refundCents: grantedCents },
    });
  } catch (err) {
    console.error(`[tutor-session] REFUND FAILED (${why}):`, err instanceof Error ? err.message : err);
  }
}

/** Remove a session row that was never reserved. Best effort: a leftover row
 *  has no money on it and `reserved_at IS NULL`, so nothing will settle it. */
async function discardUnreserved(supabase: Client, sessionId: string): Promise<void> {
  const { error } = await supabase.from('tutor_sessions').delete().eq('id', sessionId);
  if (error) console.warn('[tutor-session] could not remove unreserved session row:', error.message);
}
