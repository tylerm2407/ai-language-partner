/**
 * Turn one finished voice-tutor session into a learning record.
 *
 * A live session produces nothing durable while it is running: the media path
 * is client-to-provider, and the transcript is buffered rather than graded turn
 * by turn. Everything the session is worth to the learner is created here, once,
 * from a single batch analysis of the whole transcript.
 *
 * ── Why this is a module and not part of the `end` handler ────────────────
 *
 * Two callers need the identical sequence: the `end` action of `tutor-session`,
 * and `tutor-session-reaper`, which recovers sessions the app was killed during.
 * The reaper path is the one that matters — a learner whose phone died mid-call
 * did the speaking, and their corrections, their evidence and their cards are
 * owed to them exactly as if they had tapped "end". A second copy of this
 * sequence would drift, and the way it drifts is silent: the recovered session
 * would quietly be worth less than the clean one.
 *
 * ── The order is load-bearing ─────────────────────────────────────────────
 *
 * `ai-chat`'s `finalizeTurn` establishes it: correction first, then evidence,
 * then cards. This module keeps that relative order, with one structural
 * difference forced by the batch shape — `TutorAnalysis.vocabulary` is
 * session-level, not per-turn, because ONE model call reads the whole
 * transcript. So corrections and evidence interleave per turn, and the cards
 * are banked once after the last turn. Correction still precedes evidence for
 * every turn, and every card is written after every piece of evidence.
 *
 * Memory comes after all of that, and the prune after the memory, because a
 * prune that ran first would rank against a set this session had not yet
 * contributed to. The debrief is written last: it is the only artefact the
 * learner sees immediately, and writing it last means it is never on screen
 * describing writes that had not happened yet.
 *
 * ── Everything here is best-effort ────────────────────────────────────────
 *
 * The session is over. There is no request to fail and nothing to retry into,
 * so every write logs and continues rather than throwing. A lost card must
 * never cost the learner their debrief. The returned counts are what actually
 * landed, not what was attempted, so the caller can log the difference.
 */

import { saveChatVocabulary } from "./chat-vocabulary.ts";
import type { TutorAnalysis, TutorDebrief } from "./tutor-analysis.ts";

// ─── Client ───────────────────────────────────────────────────────────────

/**
 * The slice of the Supabase client this module uses.
 *
 * Deliberately loose, matching `chat-vocabulary.ts` and `tutor-memory.ts`: the
 * PostgREST builder is a long fluent chain whose real type is generated
 * per-schema, and pinning it would only make the test double harder to write
 * without catching anything this module can get wrong. Structurally compatible
 * with `ChatVocabularyClient` and `ConversationEvidenceClient`, which is what
 * lets the same object be handed straight through to both.
 */
export type TutorWritebackClient = {
  // deno-lint-ignore no-explicit-any
  from: (table: string) => any;
  // deno-lint-ignore no-explicit-any
  rpc: (name: string, params: Record<string, unknown>) => any;
};

// ─── Tuning ───────────────────────────────────────────────────────────────

/** Log prefix, so a failure is attributable to this stage rather than to
 *  whichever function invoked it. */
const FN = "tutor-writeback";

/**
 * Which surface taught the word. `chat-vocabulary.ts` writes this to
 * `cards.tags` and it is the ONLY thing on the row that records provenance, so
 * it is what any later "where did this card come from" question is answered
 * from. Distinct from ai-chat's `['chat','vocabulary']` on purpose.
 */
const TUTOR_CARD_TAGS: readonly string[] = [
  "tutor",
  "vocabulary",
  "client_reported",
];

/**
 * How many words one whole session may bank, against ai-chat's three per turn.
 *
 * Six rather than three because the unit is different: a tutor session is ten
 * minutes of speech summarised once, not a single exchange. It is not larger
 * than that because each card costs a slot out of the learner's daily chat-card
 * allowance and comes back with its own SM-2 schedule — a session that dumps
 * twenty new cards into tomorrow's review queue has punished the learner for
 * practising.
 */
const MAX_TUTOR_CARDS = 6;

/**
 * How many memory notes one session may contribute.
 *
 * The table keeps `TUTOR_MEMORY_KEEP` (24) notes per learner per language, so
 * five per session means roughly five sessions of history — enough for the
 * tutor to feel continuous, small enough that one talkative session cannot
 * evict everything that came before it in a single prune.
 */
// ─── Public shape ─────────────────────────────────────────────────────────

export interface TutorWritebackInput {
  userId: string;
  /** `tutor_sessions.id`. Also the idempotency key — see `claimSession`. */
  sessionId: string;
  targetLanguage: string;
  nativeLanguage: string;
  level: string;
  cefrLevel: string;
  analysis: TutorAnalysis;
  /**
   * What the SERVER measured, in seconds. Overwrites `debrief.minutesSpoken`
   * unconditionally — see `minutesFrom`.
   */
  observedSeconds: number;
  /** `getEffectiveLimits().dailyChatCards`, the per-day card allowance. Passed
   *  to `saveChatVocabulary` as the ceiling its atomic counter checks. */
  chatCardLimit: number;
}

export interface TutorWritebackResult {
  correctionsLogged: number;
  evidenceRows: number;
  cardsSaved: number;
  memoryNotesWritten: number;
  /** Rows `prune_tutor_memory` deleted. Zero is the normal answer. */
  memoryPruned: number;
  /**
   * The debrief as it was stored — the analysis's, with `minutesSpoken`
   * replaced by the server's measurement. Returned rather than re-read so the
   * caller can hand it to the client in the same response.
   */
  debrief: TutorDebrief;
  /**
   * True when this session had already been written back and this call did
   * nothing. Not an error: it is the expected outcome of the reaper reaching a
   * session the `end` action already handled.
   */
  alreadyAnalyzed: boolean;
}

// ─── Minutes ──────────────────────────────────────────────────────────────

/**
 * Seconds the server observed → minutes the learner is told they spoke.
 *
 * The model's own `minutesSpoken` is discarded, always. It has no clock; it is
 * inferring duration from how much text it was given, and it is confidently
 * wrong about it — while `tutor_sessions.observed_seconds` is the same number
 * the spend ceiling bills against. Two different durations for one session,
 * one on the debrief and one in the ledger, is the kind of discrepancy a
 * learner notices and cannot be talked out of.
 *
 * One decimal place rather than whole minutes: rounding to integers renders a
 * genuine forty-second session as "0 minutes spoken", which reads as a bug
 * rather than as a short session.
 */
function minutesFrom(seconds: number): number {
  if (
    typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0
  ) return 0;
  return Math.round((seconds / 60) * 10) / 10;
}

// ─── Idempotency ──────────────────────────────────────────────────────────

/**
 * Claim this session for analysis, atomically.
 *
 * THE PROBLEM. Both callers can reach the same session. The `end` action may
 * write back and then fail to respond; the reaper may pick up a session whose
 * `end` was already halfway through. A second full run is not harmless:
 *
 *  - `correction_log` has no natural key, so a second run doubles the rows —
 *    and those rows ARE the "you have made this mistake N times" count that
 *    ai-chat shows and `learner-context.ts` feeds to the next prompt. Inflating
 *    it makes the tutor scold a learner for an error they made once.
 *  - `conversation_evidence` double-weights the session in a measured CEFR
 *    level. `conversation-evidence.ts` states the principle this violates: a
 *    wrong data point is worse than a missing one, because the learner reads
 *    the level and acts on it.
 *  - `upsert_tutor_memory` is idempotent on content but bumps `mention_count`,
 *    which is the primary sort key of the prune — so a double run promotes this
 *    session's small talk over facts that genuinely recurred.
 *  - Cards and prune are the two that genuinely do not care: the card write
 *    dedupes on `target_text` before it charges anything, and a prune is a
 *    function of the current set.
 *
 * THE GUARD. `tutor_sessions.analyzed_at` is set by a conditional UPDATE with
 * `analyzed_at IS NULL` in the predicate. Postgres evaluates that under the
 * row lock, so of two concurrent callers exactly one gets a row back and the
 * other gets none. No advisory lock, no extra table, and the marker is the
 * column the schema already added for exactly this.
 *
 * THE COST, stated plainly: the claim is taken BEFORE the writes, so a run
 * that dies in the middle leaves the session marked analysed with only part of
 * its record written, and nothing will retry it. That is the deliberate
 * direction to be wrong in. Every artefact here is derived and re-derivable
 * from a transcript we still hold, whereas a duplicated correction count or a
 * double-counted evidence row silently corrupts two numbers the learner is
 * shown and cannot see the inputs to.
 *
 * A claim that ERRORS fails open — we proceed. An error means the database did
 * not answer, not that someone else won; refusing to write on that basis would
 * turn one flaky query into a session with no record at all, and the writes
 * that follow will fail for the same reason anyway if the outage is real.
 */
async function claimSession(
  supabase: TutorWritebackClient,
  sessionId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("tutor_sessions")
      .update({ analyzed_at: new Date().toISOString() })
      .eq("id", sessionId)
      .is("analyzed_at", null)
      .select("id");

    if (error) {
      console.warn(
        `[${FN}] analysis claim failed, proceeding unguarded:`,
        error.message,
      );
      return true;
    }
    // An empty array is the one unambiguous answer: the row exists and someone
    // else already stamped it. Anything else (including a client double that
    // returns no array at all) is treated as "claimed", for the same fail-open
    // reason as the error branch.
    if (Array.isArray(data) && data.length === 0) return false;
    return true;
  } catch (err) {
    console.warn(`[${FN}] analysis claim threw, proceeding unguarded:`, err);
    return true;
  }
}

// ─── The whole write-back ─────────────────────────────────────────────────

/**
 * Perform every write one finished tutor session owes the learner.
 *
 * Returns what actually landed. Never throws: see the file header.
 */
export async function writeBackTutorSession(
  supabase: TutorWritebackClient,
  input: TutorWritebackInput,
): Promise<TutorWritebackResult> {
  // Built before anything is written, so the early-return path and the normal
  // path hand back an identically-corrected debrief.
  const debrief: TutorDebrief = {
    ...input.analysis.debrief,
    minutesSpoken: minutesFrom(input.observedSeconds),
  };

  const claimed = await claimSession(supabase, input.sessionId);
  if (!claimed) {
    // Somebody else already wrote this session back. The debrief returned here
    // is this call's own, not a re-read of the stored one: they describe the
    // same session from the same transcript, and a round trip to fetch the
    // other copy would buy nothing a caller can act on.
    console.log(
      `[${FN}] session ${input.sessionId} already analysed; skipping write-back`,
    );
    return {
      correctionsLogged: 0,
      evidenceRows: 0,
      cardsSaved: 0,
      memoryNotesWritten: 0,
      memoryPruned: 0,
      debrief,
      alreadyAnalyzed: true,
    };
  }

  // An empty `turns` array is a meaningful state, not an empty session:
  // `analyzeTutorSession` returns one whenever no model actually read the
  // conversation — a provider outage, a safety fallback, a refusal, a truncated
  // completion. Doing nothing is the correct response and the ONLY correct
  // response. Turns are derived from the transcript rather than from the model,
  // so reconstructing evidence rows here would be trivial and catastrophic:
  // `turn-accuracy.ts` scores a null correction as 1.0, so an outage would
  // write a session's worth of perfect-accuracy evidence and push the measured
  // speaking level UP. The outage would look like the product working.
  //
  // NOTE FOR CALLERS: the claim above has already stamped `analyzed_at`, so a
  // session handed to this function with an empty analysis is marked as
  // analysed and will not be retried. That is deliberate — `analyzed_at` is
  // owned by whoever decides a session is finished with, and this module cannot
  // tell "the model was down" from "the learner said nothing worth scoring".
  // A caller that wants a failed analysis retried must not call this at all.
  const turns = Array.isArray(input.analysis.turns) ? input.analysis.turns : [];
  let correctionsLogged = 0;
  let evidenceRows = 0;

  // Realtime transcript events currently arrive through the authenticated
  // device control channel. Ownership is proven; audio provenance is not. Do
  // not let a modified client turn arbitrary strings into correction history,
  // measured CEFR evidence, or durable tutor memory. The debrief and optional
  // cards remain useful learner-owned notes and are explicitly tagged
  // `client_reported`. When a provider-observed sideband transcript is added,
  // it can take a separate validated write path rather than weakening this one.
  void turns;
  correctionsLogged = 0;
  evidenceRows = 0;

  // (3) Cards last of the three, as in `finalizeTurn` — but once for the
  // session rather than once per turn, because the analysis chooses the
  // session's vocabulary as a whole. `saveChatVocabulary` owns the
  // dedupe → charge → insert → refund sequence; it is not reimplemented here
  // for the reason its own header gives, that a second copy drifts silently
  // and the drift costs the learner card slots.
  const savedWords = await saveChatVocabulary(supabase, {
    userId: input.userId,
    targetLanguage: input.targetLanguage,
    cefrLevel: input.cefrLevel,
    words: Array.isArray(input.analysis.vocabulary)
      ? input.analysis.vocabulary
      : [],
    limit: input.chatCardLimit,
    tags: TUTOR_CARD_TAGS,
    maxCandidates: MAX_TUTOR_CARDS,
    fn: FN,
  });

  // (4) Memory, then (5) the prune.
  const memory = { written: 0, pruned: 0 };

  // (6) The debrief, last. `analyzed_at` was already stamped by the claim, so
  // this update carries only the payload.
  try {
    const { error } = await supabase
      .from("tutor_sessions")
      .update({ debrief })
      .eq("id", input.sessionId);
    if (error) {
      console.warn(`[${FN}] debrief write failed (non-fatal):`, error.message);
    }
  } catch (err) {
    console.warn(`[${FN}] debrief write threw (non-fatal):`, err);
  }

  return {
    correctionsLogged,
    evidenceRows,
    cardsSaved: savedWords.length,
    memoryNotesWritten: memory.written,
    memoryPruned: memory.pruned,
    debrief,
    alreadyAnalyzed: false,
  };
}
