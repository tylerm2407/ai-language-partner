/**
 * One exchange of a live session: the safety guard and the liveness heartbeat,
 * deliberately fused into a single round trip.
 *
 * They are one call rather than two because they fire on the same cadence and
 * because a design where the guard succeeds and the heartbeat fails is a bug
 * waiting to be written — the session would look abandoned to the reaper while
 * the learner was still talking, and get settled out from under them.
 *
 * WHAT THE HEARTBEAT ACTUALLY BUYS
 *
 * `last_heartbeat_at` is the single value that decides how much of an abandoned
 * session is refunded. If the app is force-killed mid-call, the reaper settles
 * to the last moment we can prove the learner was still there. So this write is
 * not bookkeeping — it is the mechanism that bounds what a crash costs someone.
 *
 * WHY `remainingSeconds` IS COMPUTED HERE AND NOT ACCEPTED FROM THE CLIENT
 *
 * The client reports `elapsedSeconds` and we log it, but every decision uses
 * `started_at` from the database. A client that can report its own elapsed time
 * can report zero.
 */
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { appendTurns, BUFFER_GRACE_SECONDS } from '../_shared/tutor-transcript-buffer.ts';
import { checkTutorOutput, TUTOR_MAX_SAFETY_CUTS } from './safety.ts';
import { hangupCall } from '../_shared/tutor-calls.ts';

// deno-lint-ignore no-explicit-any
type Client = any;

export interface TurnRequest {
  sessionId: string;
  /** Client-reported. ADVISORY ONLY — logged for drift, never billed. */
  elapsedSeconds?: number;
  tutorText?: string;
  learnerText?: string;
  recognizerConfidence?: number;
}

export interface TurnResult {
  status: number;
  // deno-lint-ignore no-explicit-any
  body: Record<string, any>;
}

/** Transcripts are capped again here even though the client caps them: a cap
 *  the client owns is not a cap. */
const MAX_TEXT_CHARS = 1000;

export async function handleTurn(
  supabase: Client,
  userId: string,
  req: TurnRequest,
  env: { openaiKey: string | null },
): Promise<TurnResult> {
  if (!req.sessionId) {
    return { status: 400, body: { error: 'sessionId is required', code: 'BAD_REQUEST' } };
  }

  // Fails OPEN, and that is right here: the money is already reserved, so
  // blocking a guard call would remove the safety check without saving
  // anything. 120/minute is ten times the honest rate for a 20s heartbeat plus
  // per-turn calls, and still caps a runaway client.
  const withinBurst = await checkBurstLimit(supabase, userId, 'tutor-turn', 120, 60);
  if (!withinBurst) {
    return { status: 429, body: { error: 'Too many requests.', code: 'RATE_LIMITED' } };
  }

  const { data: session, error } = await supabase
    .from('tutor_sessions')
    .select('id, user_id, target_language, started_at, granted_seconds, ended_at, safety_cuts, call_id')
    .eq('id', req.sessionId)
    .maybeSingle();

  if (error || !session) {
    return { status: 404, body: { error: 'Session not found.', code: 'SESSION_NOT_FOUND' } };
  }
  // Never trust the sessionId alone. Without this, any authenticated learner
  // could heartbeat — and read the remaining budget of — somebody else's call.
  if (session.user_id !== userId) {
    return { status: 404, body: { error: 'Session not found.', code: 'SESSION_NOT_FOUND' } };
  }
  if (session.ended_at) {
    return { status: 409, body: { error: 'Session already ended.', code: 'SESSION_ENDED' } };
  }

  const startedAt = new Date(session.started_at).getTime();
  const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const remainingSeconds = Math.max(0, session.granted_seconds - elapsed);

  // ── safety, on the tutor's words ────────────────────────────────────
  let cut = false;
  let safe = true;
  let flags: string[] = [];
  const tutorText = typeof req.tutorText === 'string' ? req.tutorText.slice(0, MAX_TEXT_CHARS) : '';

  if (tutorText.trim().length > 0) {
    const verdict = await checkTutorOutput(tutorText, {
      language: session.target_language,
      apiKey: env.openaiKey,
    });
    safe = verdict.safe;
    flags = verdict.flags;
    if (!verdict.safe) {
      cut = true;
      await recordSafetyEvent(supabase, {
        userId,
        sessionId: session.id,
        language: session.target_language,
        speaker: 'tutor',
        flags: verdict.flags,
        excerpt: tutorText,
        cutAudio: true,
      });
      console.warn(JSON.stringify({
        evt: 'safety_reject',
        fn: 'tutor-session',
        scope: 'realtime_output',
        source: verdict.source,
        reasons: verdict.flags,
        language: session.target_language,
        ts: new Date().toISOString(),
      }));
    }
  }

  // The learner's own words are checked for the record, never to cut. Cutting a
  // learner off for swearing in the language they are learning is not a safety
  // feature, it is a way to stop them talking.
  const learnerText = typeof req.learnerText === 'string' ? req.learnerText.slice(0, MAX_TEXT_CHARS) : '';
  if (learnerText.trim().length > 0) {
    const learnerVerdict = await checkTutorOutput(learnerText, {
      language: session.target_language,
      apiKey: env.openaiKey,
    });
    if (!learnerVerdict.safe) {
      await recordSafetyEvent(supabase, {
        userId,
        sessionId: session.id,
        language: session.target_language,
        speaker: 'learner',
        flags: learnerVerdict.flags,
        excerpt: learnerText,
        cutAudio: false,
      });
    }
  }

  const safetyCuts = session.safety_cuts + (cut ? 1 : 0);

  // ── buffer + heartbeat ──────────────────────────────────────────────
  const buffered: { speaker: 'learner' | 'tutor'; text: string; recognizerConfidence?: number }[] = [];
  if (learnerText.trim()) {
    buffered.push({
      speaker: 'learner',
      text: learnerText,
      ...(typeof req.recognizerConfidence === 'number'
        ? { recognizerConfidence: req.recognizerConfidence }
        : {}),
    });
  }
  // A cut turn is NOT buffered. The learner did not hear it, so it must not
  // appear in their transcript, their debrief, or their SRS cards as though
  // they had.
  if (tutorText.trim() && !cut) buffered.push({ speaker: 'tutor', text: tutorText });

  await Promise.all([
    appendTurns(session.id, buffered, session.granted_seconds + BUFFER_GRACE_SECONDS),
    supabase
      .from('tutor_sessions')
      .update({
        last_heartbeat_at: new Date().toISOString(),
        ...(cut ? { safety_cuts: safetyCuts } : {}),
      })
      .eq('id', session.id),
  ]);

  const terminate = remainingSeconds <= 0 || safetyCuts >= TUTOR_MAX_SAFETY_CUTS;
  const reason = remainingSeconds <= 0
    ? 'budget'
    : safetyCuts >= TUTOR_MAX_SAFETY_CUTS
      ? 'safety'
      : undefined;

  // `terminate` used to be advice the device could ignore. With the call id
  // on the row it is an instruction we carry out: the third safety cut and
  // the end of the budget both hang the call up here, whatever the device
  // does next. Best-effort — `end` and the reaper repeat it.
  if (terminate && typeof session.call_id === 'string' && session.call_id && env.openaiKey) {
    const outcome = await hangupCall(env.openaiKey, session.call_id);
    if (outcome !== 'ended') {
      console.error(`[tutor-session] hangup on ${reason} failed for ${session.id}`);
    }
  }

  return {
    status: 200,
    body: {
      safe,
      cut,
      terminate,
      ...(reason ? { reason } : {}),
      remainingSeconds,
      ...(flags.length > 0 ? { flagCount: flags.length } : {}),
    },
  };
}

async function recordSafetyEvent(
  supabase: Client,
  e: {
    userId: string;
    sessionId: string;
    language: string;
    speaker: 'tutor' | 'learner';
    flags: string[];
    excerpt: string;
    cutAudio: boolean;
  },
): Promise<void> {
  // Deliberately NOT ai_content_reports: that table is a user-filed queue a
  // human triages for Play compliance, and machine flags at conversation rate
  // would drown the signal it exists to carry.
  const { error } = await supabase.from('tutor_safety_events').insert({
    user_id: e.userId,
    session_id: e.sessionId,
    target_language: e.language,
    speaker: e.speaker,
    flags: e.flags,
    excerpt: e.excerpt.slice(0, 500),
    cut_audio: e.cutAudio,
  });
  if (error) {
    console.error('[tutor-session] safety event insert failed:', error.message);
  }
}
