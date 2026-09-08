/**
 * What happens to a live tutor session when the app is killed mid-call.
 *
 * WHY THIS EXISTS AT ALL
 *
 * The tutor's media path is WebRTC, directly between the learner's device and
 * OpenAI. Once the ephemeral token is minted we are not in that path: there is
 * no request to meter and no socket we can close. So `tutor-session/start`
 * RESERVES the whole grant up front — every second and every cent — and the
 * client is expected to call `end`, which settles down to what the server
 * actually observed and refunds the difference.
 *
 * A force-killed app never calls `end`. Without this module that learner has
 * paid, in full, for minutes they did not use, and nothing would ever give
 * them back. This is the thing that makes reserve-and-refund fair rather than
 * merely safe: every three minutes it finds sessions whose heartbeat has gone
 * stale, settles them to `last_heartbeat_at` — the last moment we can PROVE
 * the learner was there — and refunds the rest. A hard kill therefore costs at
 * most one `TUTOR_REAP_AFTER_SECONDS` window of budget instead of the whole
 * grant.
 *
 * ── Why the money moves in two phases, not one pass ───────────────────────
 *
 * Settlement is a couple of cheap database calls. Recovering the LEARNING from
 * an abandoned session is an Anthropic call per session, seconds each. A single
 * per-session loop over a full batch of 50 would spend its whole wall clock on
 * analysis, and the sessions at the back of the queue would not get their money
 * back until the run after — or the run after that.
 *
 * So phase A settles every session in the batch, and phase B recovers the
 * learning under a wall-clock budget. That is only sound because of one
 * property worth stating outright: SETTLEMENT DOES NOT DEPEND ON WHEN IT RUNS.
 * The refund is computed from `last_heartbeat_at - started_at`, both already on
 * the row, so deferring phase B by a tick changes nothing about the amount.
 *
 * ── Replay safety ──────────────────────────────────────────────────────────
 *
 * `ended_at IS NULL` is this function's own queue predicate, so the close is
 * written LAST and everything before it is replayable. Migration 120 makes the
 * observed-use claim and both refunds one Postgres transaction; a failure
 * rolls the complete settlement back. Analysis has its own `analyzed_at`
 * idempotency claim in `writeBackTutorSession`.
 *
 * ── Everything here is injected ───────────────────────────────────────────
 *
 * `index.ts` is a `serve()` + auth + wiring shell and nothing else. Every
 * decision — which sessions are stale, how much to refund, when to skip the
 * analysis, when to stop — lives here behind `ReaperDeps` so it can be tested
 * against a stub with no database, no Redis and no provider.
 */

import {
  settlement,
  TUTOR_REAP_AFTER_SECONDS,
} from "../_shared/tutor-pricing.ts";
import type { BufferedTurn } from "../_shared/tutor-transcript-buffer.ts";
import type { TutorAnalysis } from "../_shared/tutor-analysis.ts";

/** Log prefix, so a line is attributable to this stage. */
const FN = "tutor-session-reaper";

/**
 * How many sessions one tick will look at.
 *
 * Fifty is far more than a healthy day produces — abandonment is the exception,
 * not the norm — so this is a bound on the pathological case (an outage that
 * dropped every live session at once), not a throughput target. It exists so
 * that one bad tick cannot turn into an unbounded run against the provider.
 */
export const REAP_BATCH_LIMIT = 50;

/**
 * How long automated safety flags are kept.
 *
 * `tutor_safety_events` is machine-generated at conversation rate and is
 * deny-all to clients (migration 110). Its value is spotting a PATTERN — a
 * prompt that keeps steering the tutor somewhere it should not go — and a
 * quarter is long enough to see one. Keeping it forever would accumulate the
 * exact text a safety filter cut, indefinitely, for no additional benefit.
 */
export const SAFETY_EVENT_RETENTION_DAYS = 90;

/**
 * Wall-clock budget for phase B.
 *
 * The pg_cron entry in migration 110 posts with `timeout_milliseconds := 60000`
 * and the job fires every three minutes, so a run has no reason to outlive its
 * caller. Forty-five seconds leaves headroom for phase A, the safety sweep and
 * the response. Sessions that do not fit are simply left open and picked up by
 * the next tick with their money already refunded.
 */
export const DEFAULT_ANALYSIS_BUDGET_MS = 45_000;
export const MAX_ANALYSIS_ATTEMPTS = 3;

// ─── The row ──────────────────────────────────────────────────────────────

/** The columns of `public.tutor_sessions` this module reads. */
export interface ReapableSession {
  id: string;
  user_id: string;
  target_language: string;
  native_language: string;
  level: string;
  cefr_level: string;
  correction_mode: "as_you_go" | "let_me_talk";
  granted_seconds: number;
  granted_cents: number;
  started_at: string;
  last_heartbeat_at: string;
  provider_connected_at?: string | null;
  provider_deadline_at?: string | null;
  /** Non-null when a previous tick already settled the money and only the
   *  learning half is outstanding. */
  observed_seconds: number | null;
}

/** Outcome of the conditional `observed_seconds IS NULL` update. */
export type SettleClaim =
  | { status: "settled" | "already"; observedSeconds: number }
  | { status: "error" };

// ─── Injected effects ─────────────────────────────────────────────────────

/**
 * Every side effect the reaper performs, as a value. Deliberately narrow: each
 * method does ONE database, Redis or provider thing and reports plainly.
 */
export interface ReaperDeps {
  /** Milliseconds since epoch. Injected so the stale-window boundary is
   *  testable without sleeping. */
  now(): number;

  /** `SELECT ... WHERE ended_at IS NULL AND last_heartbeat_at < cutoff
   *  ORDER BY last_heartbeat_at LIMIT n`. */
  listStale(cutoffIso: string, limit: number): Promise<ReapableSession[]>;

  /** End the actual provider call before any ledger row becomes terminal. */
  terminateProvider(sessionId: string): Promise<"ended" | "busy" | "failed">;

  /** Atomically records observed use and applies both quota refunds. */
  settleSession(
    sessionId: string,
    userId: string,
    settlement: SessionSettlement,
  ): Promise<SettleClaim>;

  /** `available: false` means the buffer was LOST, not that nobody spoke. */
  readTranscript(
    sessionId: string,
  ): Promise<{ turns: BufferedTurn[]; available: boolean }>;

  /** `analyzeTutorSession`. Never throws in production; the reaper does not
   *  rely on that and catches anyway. */
  analyze(
    session: ReapableSession,
    turns: BufferedTurn[],
  ): Promise<TutorAnalysis>;

  /** `writeBackTutorSession`, which owns its own `analyzed_at` claim. */
  writeBack(
    session: ReapableSession,
    analysis: TutorAnalysis,
    observedSeconds: number,
  ): Promise<{ alreadyAnalyzed: boolean }>;

  /** Atomically increments the durable analysis attempt counter. */
  recordAnalysisFailure(
    sessionId: string,
    userId: string,
    error: unknown,
  ): Promise<number>;

  /** Conditional `UPDATE ... SET ended_at = now(), end_reason = 'abandoned',
   *  observed_seconds = $2 WHERE id = $1 AND ended_at IS NULL`. */
  closeSession(sessionId: string, observedSeconds: number): Promise<void>;

  /** Best-effort Redis cleanup. */
  dropTranscript(sessionId: string): Promise<void>;

  /** `DELETE FROM tutor_safety_events WHERE created_at < cutoff`, returning
   *  the row count. */
  sweepSafetyEvents(cutoffIso: string): Promise<number>;
}

export interface ReapOptions {
  /** Defaults to `REAP_BATCH_LIMIT`. */
  limit?: number;
  /** Defaults to `DEFAULT_ANALYSIS_BUDGET_MS`. */
  analysisBudgetMs?: number;
  /**
   * Settle but leave open without analysing. Set by `index.ts` when
   * `ANTHROPIC_API_KEY` is absent: money still moves, while the transcript
   * remains queued until the configuration is repaired.
   */
  skipAnalysis?: boolean;
}

/**
 * What the run did, in enough detail that a single log line explains a tick.
 *
 * The counts are deliberately not collapsed into "succeeded / failed". Each of
 * these means something different operationally: `lostBuffer` climbing is a
 * Redis problem, `settlementFailures` above zero needs a retry,
 * `deferred` climbing means the batch is bigger than a tick can carry, and
 * `errors` is the only one that means "something is broken in here".
 */
export interface ReapSummary {
  /** Rows the query returned. */
  scanned: number;
  /** Sessions whose money this run settled and refunded. */
  settled: number;
  /** Sessions a previous tick (or the `end` action) had already settled. */
  alreadySettled: number;
  /** Atomic settlement transactions that rolled back and remain retryable. */
  settlementFailures: number;
  /** Sessions closed with `end_reason = 'abandoned'` this run. */
  reaped: number;
  /** Sessions whose transcript was analysed and written back this run. */
  analyzed: number;
  /** Sessions `writeBackTutorSession` reported as already analysed. Normal:
   *  it means the `end` action got there first. */
  alreadyAnalyzed: number;
  /** Transcript buffer gone — Redis outage or TTL expiry. NO analysis was
   *  attempted for these; we do not invent a transcript. */
  lostBuffer: number;
  /** Buffer intact and genuinely empty. Nobody spoke; nothing to analyse. */
  emptyTranscript: number;
  /** Analysis suppressed by `skipAnalysis`. */
  analysisSkipped: number;
  /** Analysis failures left open for a bounded retry. */
  analysisRetries: number;
  /** Settled but left open by the wall-clock budget. Next tick finishes them. */
  deferred: number;
  /** Sessions that threw. Each is isolated; the rest of the batch continues. */
  errors: number;
  safetyEventsDeleted: number;
  safetySweepFailed: boolean;
}

function emptySummary(): ReapSummary {
  return {
    scanned: 0,
    settled: 0,
    alreadySettled: 0,
    settlementFailures: 0,
    reaped: 0,
    analyzed: 0,
    alreadyAnalyzed: 0,
    lostBuffer: 0,
    emptyTranscript: 0,
    analysisSkipped: 0,
    analysisRetries: 0,
    deferred: 0,
    errors: 0,
    safetyEventsDeleted: 0,
    safetySweepFailed: false,
  };
}

// ─── Pure decisions ───────────────────────────────────────────────────────

/**
 * The instant a heartbeat has to predate for its session to be reapable.
 *
 * This one expression is the entire definition of "abandoned", and the value
 * it is built from is the learner-visible cost of a force-kill — see
 * `TUTOR_REAP_AFTER_SECONDS`. Exported so the boundary is testable directly
 * rather than only through a stubbed query.
 */
export function staleCutoffIso(nowMs: number): string {
  return new Date(nowMs - TUTOR_REAP_AFTER_SECONDS * 1000).toISOString();
}

/** The instant a safety flag has to predate to be swept. */
export function safetyCutoffIso(nowMs: number): string {
  return new Date(nowMs - SAFETY_EVENT_RETENTION_DAYS * 86_400_000)
    .toISOString();
}

/**
 * A defensive re-check of what the query was asked for.
 *
 * The SQL predicate is the real filter; this is here because a `listStale`
 * that quietly stopped applying it would otherwise settle LIVE sessions out
 * from under learners who are mid-conversation, and that failure would look
 * like nothing at all from the outside. Cheap insurance against the one bug in
 * this function that would be invisible and expensive.
 */
export function isStale(session: ReapableSession, nowMs: number): boolean {
  const deadline = session.provider_deadline_at
    ? Date.parse(session.provider_deadline_at)
    : NaN;
  if (Number.isFinite(deadline) && deadline <= nowMs) return true;
  const beat = Date.parse(session.last_heartbeat_at);
  if (!Number.isFinite(beat)) return false;
  return beat < nowMs - TUTOR_REAP_AFTER_SECONDS * 1000;
}

/**
 * How long we can prove the learner was present.
 *
 * `last_heartbeat_at - started_at`, and never `now()`: everything after the
 * last heartbeat is time we cannot demonstrate they were there for, and this
 * function existing at all is a commitment not to bill it. Returns null when
 * either timestamp is unreadable — a `timestamptz NOT NULL DEFAULT now()`
 * column cannot produce that, so it means something upstream is wrong, and
 * guessing would mean guessing about money.
 */
export function observedSecondsFor(session: ReapableSession): number | null {
  const start = Date.parse(session.provider_connected_at ?? session.started_at);
  const beat = Date.parse(session.last_heartbeat_at);
  if (!Number.isFinite(start) || !Number.isFinite(beat)) return null;
  return Math.max(0, Math.round((beat - start) / 1000));
}

/** What this session owes, or null when its timestamps cannot be read. */
export interface SessionSettlement {
  /** CLAMPED to the grant — see `settleFor`. This is the number written to
   *  `tutor_sessions.observed_seconds` and handed to the write-back. */
  observedSeconds: number;
  refundSeconds: number;
  refundCents: number;
}

/**
 * The whole settlement for one session, in one place.
 *
 * The clamp matters and is easy to lose. Raw elapsed time can EXCEED the grant
 * — a client that ignored its own limit keeps heartbeating past it, and the
 * last heartbeat we see is then later than the session was ever entitled to
 * run. `settlement()` clamps that to `granted_seconds`, and the clamped figure
 * is the one that must be stored: `observed_seconds` is the column the spend
 * ceiling reconciles against and the column the debrief's "minutes spoken" is
 * derived from, so writing 609 seconds against a 600-second grant would both
 * overstate our own costs and tell the learner they spoke for longer than we
 * ever let them.
 */
export function settleFor(
  session: ReapableSession,
  nowMs = Date.now(),
): SessionSettlement | null {
  const deadline = session.provider_deadline_at
    ? Date.parse(session.provider_deadline_at)
    : NaN;
  if (Number.isFinite(deadline) && deadline <= nowMs) {
    return settlement(
      session.granted_seconds,
      session.granted_cents,
      session.granted_seconds,
    );
  }
  const raw = observedSecondsFor(session);
  if (raw === null) return null;
  return settlement(session.granted_seconds, session.granted_cents, raw);
}

// ─── Phase A: the money ───────────────────────────────────────────────────

/**
 * Settle one session and refund what it did not use.
 *
 * The database changes observed_seconds and both quota rows atomically. An error
 * leaves the session entirely untouched for the next tick. An idempotent retry
 * returns the stored winning observation so a competing worker cannot
 * overwrite it with a later estimate.
 */
async function settleOne(
  deps: ReaperDeps,
  session: ReapableSession,
  owed: SessionSettlement,
  summary: ReapSummary,
): Promise<number | null> {
  const claim = await deps.settleSession(session.id, session.user_id, owed);

  if (claim.status === "already") {
    summary.alreadySettled += 1;
    return claim.observedSeconds;
  }
  if (claim.status === "error") {
    // The database transaction rolled back, so leaving the row open makes the
    // complete settlement retryable on the next tick.
    console.error(
      `[${FN}] atomic settlement failed for ${session.id}; leaving it for the next tick`,
    );
    summary.settlementFailures += 1;
    summary.errors += 1;
    return null;
  }

  summary.settled += 1;
  return claim.observedSeconds;
}

// ─── Phase B: the learning, then the close ────────────────────────────────

/**
 * Recover what the session was worth to the learner, then close the row.
 *
 * A learner whose phone died mid-call did the speaking. Their corrections,
 * their evidence and their cards are owed to them exactly as if they had
 * tapped "end", which is why `writeBackTutorSession` is shared with the `end`
 * action rather than reimplemented here.
 *
 * `available: false` means the buffer is GONE — Redis is down, or the TTL
 * expired. We skip the analysis entirely and say so. Handing the analyser an
 * empty transcript instead would produce a confident, empty debrief describing
 * a conversation we simply failed to keep, and the learner would have no way
 * to tell that from a session where they said nothing.
 *
 * Analysis failures are durably counted and retried. The third failure closes
 * the session but retains the transcript for manual recovery, bounding poison
 * rows without turning a transient provider outage into immediate data loss.
 */
async function recoverOne(
  deps: ReaperDeps,
  session: ReapableSession,
  observed: number,
  summary: ReapSummary,
  skipAnalysis: boolean,
): Promise<void> {
  let analysed = false;

  try {
    if (skipAnalysis) {
      summary.analysisSkipped += 1;
      console.warn(
        `[${FN}] analysis disabled; leaving ${session.id} open with its transcript retained`,
      );
      return;
    } else {
      const buffer = await deps.readTranscript(session.id);

      if (!buffer.available) {
        summary.lostBuffer += 1;
        console.warn(
          `[${FN}] transcript buffer unavailable for ${session.id} — no analysis attempted (Redis outage or TTL expiry)`,
        );
      } else if (buffer.turns.length === 0) {
        summary.emptyTranscript += 1;
        console.log(
          `[${FN}] transcript for ${session.id} is empty; nothing to analyse`,
        );
      } else {
        const analysis = await deps.analyze(session, buffer.turns);
        const written = await deps.writeBack(session, analysis, observed);
        if (written.alreadyAnalyzed) {
          summary.alreadyAnalyzed += 1;
        } else {
          summary.analyzed += 1;
        }
        analysed = true;
      }
    }
  } catch (err) {
    summary.errors += 1;
    console.error(
      `[${FN}] learning recovery failed for ${session.id}:`,
      err instanceof Error ? err.message : err,
    );
    try {
      const attempts = await deps.recordAnalysisFailure(
        session.id,
        session.user_id,
        err,
      );
      if (attempts < MAX_ANALYSIS_ATTEMPTS) {
        summary.analysisRetries += 1;
        console.warn(
          `[${FN}] leaving ${session.id} open for analysis retry ${attempts}/${MAX_ANALYSIS_ATTEMPTS}`,
        );
        return;
      }
      console.error(
        `[${FN}] analysis exhausted ${attempts} attempts for ${session.id}; closing with transcript retained`,
      );
    } catch (recordErr) {
      summary.errors += 1;
      console.error(
        `[${FN}] could not record analysis failure for ${session.id}; leaving it open:`,
        recordErr instanceof Error ? recordErr.message : recordErr,
      );
      return;
    }
  }

  // The close is last. See the file header: `ended_at IS NULL` is the queue
  // predicate, so writing it earlier would hide a half-recovered session from
  // the tick that could have finished it.
  await deps.closeSession(session.id, observed);
  summary.reaped += 1;

  // Tidiness only — the buffer carries its own TTL. Dropped after the close so
  // a failure here cannot cost the session its terminal state. Only dropped
  // when the transcript was actually consumed: if analysis was skipped or the
  // buffer read failed, leaving the key alone means a manual replay is still
  // possible within the grace window.
  if (analysed) {
    try {
      await deps.dropTranscript(session.id);
    } catch {
      // dropTranscript does not throw in production. If it somehow does, the
      // TTL collects the key and nothing is worse off.
    }
  }
}

// ─── The run ──────────────────────────────────────────────────────────────

/**
 * One tick of the reaper.
 *
 * Never throws. Every session is isolated: one bad row must not cost the other
 * forty-nine their refunds, because "the batch aborted" and "the learner was
 * charged for nothing" look identical from the outside and only one of them is
 * recoverable.
 */
export async function reapAbandonedSessions(
  deps: ReaperDeps,
  opts: ReapOptions = {},
): Promise<ReapSummary> {
  const summary = emptySummary();
  const limit = opts.limit ?? REAP_BATCH_LIMIT;
  const budgetMs = opts.analysisBudgetMs ?? DEFAULT_ANALYSIS_BUDGET_MS;
  const skipAnalysis = opts.skipAnalysis === true;

  const startedAt = deps.now();

  let sessions: ReapableSession[] = [];
  try {
    sessions = await deps.listStale(staleCutoffIso(startedAt), limit);
  } catch (err) {
    // A failed scan is not a failed run: the safety sweep below is independent
    // of it and there is no reason to skip it too.
    summary.errors += 1;
    console.error(
      `[${FN}] stale-session scan failed:`,
      err instanceof Error ? err.message : err,
    );
    sessions = [];
  }
  summary.scanned = sessions.length;

  // ── Phase A ────────────────────────────────────────────────────────────
  // Every session in the batch gets its money back before any of them get
  // analysed. See the file header for why the two phases are split.
  const settled: { session: ReapableSession; observed: number }[] = [];

  for (const session of sessions) {
    try {
      if (!isStale(session, startedAt)) {
        // The query should not have returned this. Skipping is the safe
        // direction: a live session settled early is a learner cut off
        // mid-sentence and billed for a conversation they are still having.
        summary.errors += 1;
        console.error(
          `[${FN}] listStale returned a session that is not stale: ${session.id}`,
        );
        continue;
      }

      const owed = settleFor(session, startedAt);
      if (owed === null) {
        summary.errors += 1;
        console.error(
          `[${FN}] session ${session.id} has unreadable timestamps; not settling`,
        );
        continue;
      }

      const termination = await deps.terminateProvider(session.id);
      if (termination !== "ended") {
        summary.errors += 1;
        console.error(
          `[${FN}] provider hangup ${termination} for ${session.id}; leaving it open`,
        );
        continue;
      }

      const observed = await settleOne(deps, session, owed, summary);
      if (observed !== null) {
        settled.push({ session, observed });
      }
    } catch (err) {
      summary.errors += 1;
      console.error(
        `[${FN}] settlement threw for ${session.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // ── Phase B ────────────────────────────────────────────────────────────
  for (let i = 0; i < settled.length; i++) {
    if (deps.now() - startedAt >= budgetMs) {
      // Out of wall clock. The remainder keep `ended_at IS NULL`, so the next
      // tick picks them up with their money already refunded and only the
      // learning half left to do.
      summary.deferred = settled.length - i;
      console.warn(
        `[${FN}] analysis budget exhausted; deferring ${summary.deferred} session(s)`,
      );
      break;
    }

    const { session, observed } = settled[i];
    try {
      await recoverOne(deps, session, observed, summary, skipAnalysis);
    } catch (err) {
      // `recoverOne` catches its own analysis failures, so reaching here means
      // the CLOSE failed. The session stays open and the next tick retries it;
      // the settle claim will short-circuit so it will not be refunded twice.
      summary.errors += 1;
      console.error(
        `[${FN}] could not close ${session.id}; it stays open for the next tick:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // ── The safety sweep ───────────────────────────────────────────────────
  // Once per RUN, not once per session: it is a retention policy on a table
  // that has nothing to do with which sessions happened to be abandoned, and
  // running it fifty times a tick would be fifty identical deletes.
  try {
    summary.safetyEventsDeleted = await deps.sweepSafetyEvents(
      safetyCutoffIso(startedAt),
    );
  } catch (err) {
    summary.safetySweepFailed = true;
    console.error(
      `[${FN}] safety-event sweep failed:`,
      err instanceof Error ? err.message : err,
    );
  }

  return summary;
}
