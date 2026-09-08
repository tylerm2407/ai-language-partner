/**
 * Opening a live tutor session: prepare a one-use server capability, then
 * reserve the money.
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
 * The single most important error path in this file is the one after a failed
 * mint. If we have reserved and the mint then fails, the learner has been
 * charged for a session that never happened.
 */
import { getEffectiveLimits, type PlanLimits } from "../_shared/plan-limits.ts";
import {
  fetchLearnerContext,
  isEntitledToLearnerContext,
  serializeLearnerContext,
} from "../_shared/learner-context.ts";
import {
  fetchTutorMemory,
  serializeTutorMemory,
} from "../_shared/tutor-memory.ts";
import { proficiencyToCefr } from "../_shared/cefr.ts";
import {
  resolveGrant,
  TUTOR_HEARTBEAT_SECONDS,
  TUTOR_MODEL,
} from "../_shared/tutor-pricing.ts";
import { reserveTutorSession } from "../_shared/tutor-ledger.ts";
import {
  newConnectionToken,
  sha256Hex,
} from "../_shared/tutor-provider-call.ts";
import {
  buildTutorInstructions,
  type CorrectionMode,
  turnDetectionForLevel,
} from "./instructions.ts";
import { resolvePersona, speechSpeedForLevel } from "./personas.ts";
import { type PushSignal, selectPushStance } from "../ai-chat/turn-policy.ts";

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
      supabase.rpc("fluenci_user_today", { p_uid: userId }),
      supabase.rpc("fluenci_user_month", { p_user_id: userId }),
    ]);

    const [dayRow, monthRow] = await Promise.all([
      supabase.from("daily_usage").select("tutor_seconds").eq("user_id", userId)
        .eq("date", day).maybeSingle(),
      supabase.from("monthly_usage").select("tutor_cents").eq("user_id", userId)
        .eq("month", month).maybeSingle(),
    ]);

    return {
      tutorSecondsToday: Number(dayRow?.data?.tutor_seconds ?? 0) || 0,
      tutorCentsThisMonth: Number(monthRow?.data?.tutor_cents ?? 0) || 0,
    };
  } catch (err) {
    console.warn(
      "[tutor-session] meter read failed:",
      err instanceof Error ? err.message : err,
    );
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
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${userId}:${salt}`),
  );
  return Array.from(new Uint8Array(digest)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
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
      .from("conversation_evidence")
      .select("accuracy, intelligibility")
      .eq("user_id", userId)
      .eq("target_language", targetLanguage)
      .eq("cefr_level", cefrLevel)
      .order("created_at", { ascending: false })
      .limit(30);
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return { sampleSize: 0, recentAccuracy: null };
    const acc = rows.map((r: { accuracy: number | null }) => Number(r.accuracy))
      .filter((n) => Number.isFinite(n));
    return {
      sampleSize: acc.length,
      recentAccuracy: acc.length > 0
        ? acc.reduce((a, b) => a + b, 0) / acc.length
        : null,
    };
  } catch {
    return { sampleSize: 0, recentAccuracy: null };
  }
}

export async function handleStart(
  supabase: Client,
  userId: string,
  req: StartRequest,
  env: { safetySalt: string; supabaseUrl: string },
): Promise<StartResult> {
  const targetLanguage = req.targetLanguage;
  const nativeLanguage = req.nativeLanguage || "en";
  const level = req.level;
  const cefrLevel = proficiencyToCefr(level);

  // ── tier and entitlement ────────────────────────────────────────────
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  const tier = (sub?.tier as string | undefined) ?? "starter";

  // Pass the tier. Omitting it is the documented footgun in plan-limits.ts and
  // here it would resolve every paying learner to dailyTutorMinutes: 0.
  const limits: PlanLimits = await getEffectiveLimits(userId, supabase, tier);

  if (!limits.dailyTutorMinutes || limits.dailyTutorMinutes <= 0) {
    return {
      status: 403,
      body: {
        error: "The live tutor is part of a plan.",
        code: "TUTOR_NOT_ENTITLED",
      },
    };
  }

  // ── how long may this session run ───────────────────────────────────
  const meters = await readMeters(supabase, userId);
  const grant = resolveGrant({
    dailySecondsRemaining: limits.dailyTutorMinutes * 60 -
      meters.tutorSecondsToday,
    monthlyCentsRemaining: limits.monthlyTutorCents -
      meters.tutorCentsThisMonth,
    requestedSeconds: req.requestedMinutes
      ? Math.round(req.requestedMinutes * 60)
      : undefined,
  });

  if (grant.seconds <= 0) {
    // Distinct codes, because the copy and the reset date differ: the daily one
    // comes back tonight, the monthly one does not.
    const monthly = grant.reason === "monthly";
    return {
      status: 429,
      body: {
        error: monthly
          ? "You have used all your live tutor minutes this month."
          : "You have used your live tutor time for today.",
        code: monthly
          ? "MONTHLY_TUTOR_BUDGET_REACHED"
          : "DAILY_TUTOR_LIMIT_REACHED",
      },
    };
  }

  // The database reserves both counters atomically after the pending session
  // row exists. No counter can move on its own.
  const cents = grant.cents;

  // ── assemble the instructions ───────────────────────────────────────
  const persona = resolvePersona(req.personaId);
  const [learnerCtx, memoryNotes, pushSignal] = await Promise.all([
    isEntitledToLearnerContext(tier)
      ? fetchLearnerContext(supabase, {
        userId,
        targetLanguage,
        include: ["goal", "goal_track", "pronunciation"],
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
    learnerBlock: learnerCtx
      ? serializeLearnerContext(learnerCtx, { maxChars: 1200 })
      : null,
    memoryBlock: serializeTutorMemory(memoryNotes),
    pushStance: selectPushStance(pushSignal),
  });

  // ── the session row, before the token ───────────────────────────────
  const { data: session, error: sessionErr } = await supabase
    .from("tutor_sessions")
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
      // Pending rows are terminal until reserve_tutor_session atomically
      // charges both counters and opens them. A crashed start cannot become a
      // phantom open session for the reaper.
      ended_at: new Date().toISOString(),
      end_reason: "error",
      observed_seconds: 0,
    })
    .select("id")
    .single();

  if (sessionErr || !session) {
    console.error(
      "[tutor-session] session insert failed:",
      sessionErr?.message,
    );
    return {
      status: 500,
      body: {
        error: "Could not start a session. Please try again.",
        code: "SESSION_INSERT_FAILED",
      },
    };
  }

  const connectionToken = newConnectionToken();
  const connectionTokenExpiresAt = Math.floor(Date.now() / 1000) + 120;
  const sessionConfig = {
    type: "realtime",
    model: TUTOR_MODEL,
    instructions,
    audio: {
      output: { voice: persona.voice, speed: speechSpeedForLevel(level) },
      input: {
        turn_detection: turnDetectionForLevel(level),
        transcription: { model: "whisper-1" },
      },
    },
    max_output_tokens: MAX_OUTPUT_TOKENS,
    tools: [],
  };
  const prepared = await supabase.from("tutor_provider_connections").insert({
    session_id: session.id,
    token_hash: await sha256Hex(connectionToken),
    session_config: sessionConfig,
    safety_identifier: await safetyIdentifier(userId, env.safetySalt),
    expires_at: new Date(connectionTokenExpiresAt * 1000).toISOString(),
  });
  if (prepared.error) {
    console.error(
      "[tutor-session] provider capability insert failed:",
      prepared.error.message,
    );
    return {
      status: 500,
      body: {
        error: "Could not prepare the tutor. Please try again.",
        code: "SESSION_PREPARE_FAILED",
      },
    };
  }

  let reserveStatus;
  try {
    reserveStatus = await reserveTutorSession(supabase, {
      sessionId: session.id,
      userId,
      dailyLimit: limits.dailyTutorMinutes * 60,
      monthlyLimit: limits.monthlyTutorCents,
    });
  } catch (err) {
    console.error(
      "[tutor-session] atomic reservation failed:",
      err instanceof Error ? err.message : err,
    );
    await supabase.from("tutor_provider_connections").delete().eq(
      "session_id",
      session.id,
    );
    return {
      status: 500,
      body: {
        error: "Could not reserve tutor time. Please try again.",
        code: "RESERVATION_FAILED",
      },
    };
  }

  if (reserveStatus === "monthly_limit") {
    await supabase.from("tutor_provider_connections").delete().eq(
      "session_id",
      session.id,
    );
    return {
      status: 429,
      body: {
        error: "You have used all your live tutor minutes this month.",
        code: "MONTHLY_TUTOR_BUDGET_REACHED",
      },
    };
  }
  if (reserveStatus === "daily_limit") {
    await supabase.from("tutor_provider_connections").delete().eq(
      "session_id",
      session.id,
    );
    return {
      status: 429,
      body: {
        error: "You have used your live tutor time for today.",
        code: "DAILY_TUTOR_LIMIT_REACHED",
      },
    };
  }
  if (reserveStatus === "active_session") {
    await supabase.from("tutor_provider_connections").delete().eq(
      "session_id",
      session.id,
    );
    return {
      status: 409,
      body: {
        error: "A tutor session is already active.",
        code: "TUTOR_SESSION_ACTIVE",
      },
    };
  }

  return {
    status: 200,
    body: {
      sessionId: session.id,
      connectionToken,
      connectionTokenExpiresAt,
      model: TUTOR_MODEL,
      callsUrl: `${env.supabaseUrl}/functions/v1/tutor-session`,
      grantedSeconds: grant.seconds,
      heartbeatIntervalSeconds: TUTOR_HEARTBEAT_SECONDS,
      correctionMode: req.correctionMode,
      personaId: persona.id,
      remainingTutorMinutesToday: Math.max(
        0,
        Math.floor(
          (limits.dailyTutorMinutes * 60 - meters.tutorSecondsToday -
            grant.seconds) / 60,
        ),
      ),
    },
  };
}
