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
 * The server accumulated it turn by turn in Redis, from calls it authenticated.
 * Accepting an end-of-session transcript from the client instead would let a
 * modified client author its own learning record — and SRS cards cost a metered
 * `chat_cards` slot, so that is a way to mint vocabulary the learner never met.
 */
import { proficiencyToCefr } from '../_shared/cefr.ts';
import { getEffectiveLimits } from '../_shared/plan-limits.ts';
import { settlement } from '../_shared/tutor-pricing.ts';
import { readTranscript, dropTranscript } from '../_shared/tutor-transcript-buffer.ts';
import { analyzeTutorSession } from '../_shared/tutor-analysis.ts';
import { writeBackTutorSession } from '../_shared/tutor-writeback.ts';

// deno-lint-ignore no-explicit-any
type Client = any;

export type TutorEndReason = 'learner' | 'budget' | 'safety' | 'timeout' | 'error';

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
  env: { anthropicKey: string | null },
): Promise<EndResult> {
  if (!req.sessionId) {
    return { status: 400, body: { error: 'sessionId is required', code: 'BAD_REQUEST' } };
  }

  const { data: session, error } = await supabase
    .from('tutor_sessions')
    .select(
      'id, user_id, target_language, native_language, level, cefr_level, started_at, ' +
        'last_heartbeat_at, granted_seconds, granted_cents, ended_at, observed_seconds, ' +
        'correction_mode, debrief',
    )
    .eq('id', req.sessionId)
    .maybeSingle();

  if (error || !session) {
    return { status: 404, body: { error: 'Session not found.', code: 'SESSION_NOT_FOUND' } };
  }
  // Never trust the sessionId alone: without this any authenticated learner
  // could settle — and read the debrief of — somebody else's session.
  if (session.user_id !== userId) {
    return { status: 404, body: { error: 'Session not found.', code: 'SESSION_NOT_FOUND' } };
  }

  // A second `end` is not an error. The client retries, and the reaper may have
  // got there first; both should see the same debrief rather than a failure.
  if (session.ended_at) {
    return {
      status: 200,
      body: {
        sessionId: session.id,
        alreadyEnded: true,
        minutesSpoken: Math.max(1, Math.round((session.observed_seconds ?? 0) / 60)),
        debrief: session.debrief ?? null,
        savedWords: [],
      },
    };
  }

  // ── 1. settle ───────────────────────────────────────────────────────
  const startedAt = new Date(session.started_at).getTime();
  const observedRaw = Math.ceil((Date.now() - startedAt) / 1000);
  const settled = settlement(session.granted_seconds, session.granted_cents, observedRaw);

  if (settled.refundSeconds > 0 || settled.refundCents > 0) {
    const results = await Promise.allSettled([
      settled.refundSeconds > 0
        ? supabase.rpc('refund_daily_quota', {
            p_user_id: userId, p_counter: 'tutor_seconds', p_amount: settled.refundSeconds,
          })
        : Promise.resolve(null),
      settled.refundCents > 0
        ? supabase.rpc('refund_monthly_quota', {
            p_user_id: userId, p_counter: 'tutor_cents', p_amount: settled.refundCents,
          })
        : Promise.resolve(null),
    ]);
    for (const r of results) {
      if (r.status === 'rejected') {
        // A refund that does not land is a learner charged for time they did
        // not use, and it surfaces nowhere else.
        console.error('[tutor-session] REFUND FAILED on end:', r.reason);
      }
    }
  }

  // ── 2. analyse and write back (best effort) ─────────────────────────
  let debrief: unknown = null;
  let savedWords: string[] = [];
  let analyzed = false;
  let transcriptLost = false;

  try {
    const buffered = await readTranscript(session.id);
    transcriptLost = !buffered.available;

    if (buffered.available && buffered.turns.length > 0 && env.anthropicKey) {
      const cefrLevel = session.cefr_level || proficiencyToCefr(session.level);
      const analysis = await analyzeTutorSession({
        transcript: buffered.turns,
        targetLanguage: session.target_language,
        nativeLanguage: session.native_language ?? 'en',
        level: session.level,
        cefrLevel,
        correctionMode: session.correction_mode,
        apiKey: env.anthropicKey,
      });

      const limits = await getEffectiveLimits(userId, supabase);
      const written = await writeBackTutorSession(supabase, {
        userId,
        sessionId: session.id,
        targetLanguage: session.target_language,
        nativeLanguage: session.native_language ?? 'en',
        level: session.level,
        cefrLevel,
        analysis,
        observedSeconds: settled.observedSeconds,
        chatCardLimit: limits.dailyChatCards,
      });

      debrief = written.debrief;
      savedWords = analysis.vocabulary.map((v) => v.word).slice(0, written.cardsSaved);
      analyzed = !written.alreadyAnalyzed;
    }
  } catch (err) {
    // Never fatal. The money is already settled correctly, and a lost debrief
    // is recoverable by the reaper; failing the request here would tell the
    // learner their session broke when in fact it did not.
    console.error('[tutor-session] write-back failed:', err instanceof Error ? err.message : err);
  }

  // ── 3. close, LAST ──────────────────────────────────────────────────
  const { error: closeErr } = await supabase
    .from('tutor_sessions')
    .update({
      ended_at: new Date().toISOString(),
      end_reason: req.endReason ?? 'learner',
      observed_seconds: settled.observedSeconds,
    })
    .eq('id', session.id)
    // Only close a session that is still open, so a race with the reaper
    // resolves to one writer rather than two.
    .is('ended_at', null);

  if (closeErr) {
    console.error('[tutor-session] close failed:', closeErr.message);
  }

  await dropTranscript(session.id);

  return {
    status: 200,
    body: {
      sessionId: session.id,
      minutesSpoken: Math.max(1, Math.round(settled.observedSeconds / 60)),
      debrief,
      savedWords,
      analyzed,
      // Surfaced so the client can say "your notes are still being written"
      // rather than showing an empty debrief as though nothing happened.
      transcriptLost,
    },
  };
}
