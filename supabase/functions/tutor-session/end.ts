/**
 * Closing a live tutor session.
 *
 * THE ORDER IS LOAD-BEARING: settle -> analyse -> mark ended.
 *
 * Settlement is MONEY and must not depend on the analysis succeeding. The
 * analysis is one Haiku call plus up to forty inserts, and it can time out
 * against the edge wall clock; if it did and `ended_at` had already been
 * written, the session would be both unanalysed and invisible to the reaper,
 * so the learner would silently lose their cards, their evidence and their
 * debrief with nothing left to notice it.
 *
 * Writing `ended_at` LAST is what makes that recoverable: a session that dies
 * mid-analysis still has `ended_at IS NULL` and a stale heartbeat, so the
 * reaper picks it up on its next tick. The refunds are already banked by then,
 * and `writeBackTutorSession` claims the session atomically, so the reaper
 * cannot double-write what this function completed.
 *
 * WHY THE TRANSCRIPT IS NOT IN THE REQUEST BODY
 *
 * Authenticated turn calls append it to Redis incrementally instead of trusting
 * one end-of-session payload. The words still originate on the client side of
 * the direct WebRTC connection, so this transcript is suitable for learner
 * notes but is never authoritative for billing, entitlement, or safety.
 */
import { proficiencyToCefr } from "../_shared/cefr.ts";
import { getEffectiveLimits } from "../_shared/plan-limits.ts";
import { settlement } from "../_shared/tutor-pricing.ts";
import {
  recordTutorAnalysisFailure,
  settleTutorSession,
} from "../_shared/tutor-ledger.ts";
import {
  dropTranscript,
  readTranscript,
} from "../_shared/tutor-transcript-buffer.ts";
import { analyzeTutorSession } from "../_shared/tutor-analysis.ts";
import { writeBackTutorSession } from "../_shared/tutor-writeback.ts";
import { hangupTutorProvider } from "../_shared/tutor-provider-call.ts";

// deno-lint-ignore no-explicit-any
type Client = any;

export type TutorEndReason =
  | "learner"
  | "budget"
  | "safety"
  | "timeout"
  | "error";

export interface EndRequest {
  sessionId: string;
  endReason?: TutorEndReason;
}

export interface EndResult {
  status: number;
  // deno-lint-ignore no-explicit-any
  body: Record<string, any>;
}

export async function handleEnd(
  supabase: Client,
  userId: string,
  req: EndRequest,
  env: { anthropicKey: string | null; openaiKey: string },
): Promise<EndResult> {
  if (!req.sessionId) {
    return {
      status: 400,
      body: { error: "sessionId is required", code: "BAD_REQUEST" },
    };
  }

  const { data: session, error } = await supabase
    .from("tutor_sessions")
    .select(
      "id, user_id, target_language, native_language, level, cefr_level, started_at, " +
        "last_heartbeat_at, granted_seconds, granted_cents, ended_at, observed_seconds, " +
        "correction_mode, debrief, provider_connected_at",
    )
    .eq("id", req.sessionId)
    .maybeSingle();

  if (error || !session) {
    return {
      status: 404,
      body: { error: "Session not found.", code: "SESSION_NOT_FOUND" },
    };
  }
  // Never trust the sessionId alone: without this any authenticated learner
  // could settle — and read the debrief of — somebody else's session.
  if (session.user_id !== userId) {
    return {
      status: 404,
      body: { error: "Session not found.", code: "SESSION_NOT_FOUND" },
    };
  }

  // A second `end` is not an error. The client retries, and the reaper may have
  // got there first; both should see the same debrief rather than a failure.
  if (session.ended_at) {
    return {
      status: 200,
      body: {
        sessionId: session.id,
        alreadyEnded: true,
        minutesSpoken: Math.max(
          1,
          Math.round((session.observed_seconds ?? 0) / 60),
        ),
        debrief: session.debrief ?? null,
        savedWords: [],
      },
    };
  }

  // ── 1. terminate the provider call ─────────────────────────────────
  const hangup = await hangupTutorProvider(supabase, session.id, env.openaiKey);
  if (hangup !== "ended") {
    return {
      status: 503,
      body: {
        error: "Your session is still being finalized. Please retry.",
        code: "PROVIDER_HANGUP_PENDING",
      },
    };
  }

  // ── 2. settle ───────────────────────────────────────────────────────
  const startedAt = new Date(
    session.provider_connected_at ?? session.started_at,
  ).getTime();
  const observedRaw = Math.ceil((Date.now() - startedAt) / 1000);
  const wanted = settlement(
    session.granted_seconds,
    session.granted_cents,
    observedRaw,
  );
  let settled: Awaited<ReturnType<typeof settleTutorSession>>;
  try {
    settled = await settleTutorSession(supabase, {
      sessionId: session.id,
      userId,
      settlement: wanted,
    });
  } catch (err) {
    // The RPC records observed use and both refunds in one transaction. If it
    // fails, none of those writes committed and the open row remains eligible
    // for the reaper to retry.
    console.error(
      "[tutor-session] atomic settlement failed:",
      err instanceof Error ? err.message : err,
    );
    return {
      status: 503,
      body: {
        error: "Your session is still being finalized. Please retry.",
        code: "SETTLEMENT_PENDING",
      },
    };
  }

  // ── 3. analyse and write back (best effort) ─────────────────────────
  let debrief: unknown = null;
  let savedWords: string[] = [];
  let analyzed = false;
  let transcriptLost = false;
  let recoveryPending = false;

  try {
    const buffered = await readTranscript(session.id);
    transcriptLost = !buffered.available;

    if (buffered.available && buffered.turns.length > 0 && !env.anthropicKey) {
      // No analysis possible, but the session must still close: an open row
      // blocks the learner's next start (`active_session`). The transcript is
      // retained for a manual replay.
      console.error(
        "[tutor-session] ANTHROPIC_API_KEY missing; closing without analysis",
      );
    } else if (
      buffered.available && buffered.turns.length > 0 && env.anthropicKey
    ) {
      const cefrLevel = session.cefr_level || proficiencyToCefr(session.level);
      const analysis = await analyzeTutorSession({
        transcript: buffered.turns,
        targetLanguage: session.target_language,
        nativeLanguage: session.native_language ?? "en",
        level: session.level,
        cefrLevel,
        correctionMode: session.correction_mode,
        apiKey: env.anthropicKey,
      });

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("tier, is_active")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      const tier = (subscription?.tier as string | undefined) ?? "starter";
      const limits = await getEffectiveLimits(userId, supabase, tier);
      const written = await writeBackTutorSession(supabase, {
        userId,
        sessionId: session.id,
        targetLanguage: session.target_language,
        nativeLanguage: session.native_language ?? "en",
        level: session.level,
        cefrLevel,
        analysis,
        observedSeconds: settled.observedSeconds,
        chatCardLimit: limits.dailyChatCards,
      });

      debrief = written.debrief;
      savedWords = analysis.vocabulary.map((v) => v.word).slice(
        0,
        written.cardsSaved,
      );
      analyzed = !written.alreadyAnalyzed;
    }
  } catch (err) {
    // Never fatal. The money is already settled correctly, and a lost debrief
    // is recoverable by the reaper; failing the request here would tell the
    // learner their session broke when in fact it did not.
    console.error(
      "[tutor-session] write-back failed:",
      err instanceof Error ? err.message : err,
    );
    await recordTutorAnalysisFailure(supabase, {
      sessionId: session.id,
      userId,
      error: err,
    }).catch((recordErr) => {
      console.error(
        "[tutor-session] failed to record analysis retry:",
        recordErr instanceof Error ? recordErr.message : recordErr,
      );
    });
    recoveryPending = true;
  }

  // ── 4. close, LAST ──────────────────────────────────────────────────
  let closeErr: { message: string } | null = null;
  if (!recoveryPending) {
    const closed = await supabase
      .from("tutor_sessions")
      .update({
        ended_at: new Date().toISOString(),
        end_reason: req.endReason ?? "learner",
      })
      .eq("id", session.id)
      // Only close a session that is still open, so a race with the reaper
      // resolves to one writer rather than two.
      .is("ended_at", null);
    closeErr = closed.error;
  }

  if (closeErr) {
    console.error("[tutor-session] close failed:", closeErr.message);
  }

  if (!recoveryPending && !closeErr) await dropTranscript(session.id);

  return {
    status: 200,
    body: {
      sessionId: session.id,
      minutesSpoken: Math.max(1, Math.round(settled.observedSeconds / 60)),
      debrief,
      savedWords,
      analyzed,
      recoveryPending: recoveryPending || Boolean(closeErr),
      // Surfaced so the client can say "your notes are still being written"
      // rather than showing an empty debrief as though nothing happened.
      transcriptLost,
    },
  };
}
