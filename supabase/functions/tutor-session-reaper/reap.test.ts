/**
 * Tests for the abandoned-session reaper.
 *
 * What is pinned here is everything that fails SILENTLY. This function runs
 * unattended every three minutes and nobody is waiting on its response, so
 * each of its failure modes looks like nothing at all from the outside: a
 * session reaped one heartbeat too early is a learner cut off mid-conversation,
 * a refund that never landed is a learner charged for time they did not use, a
 * fabricated transcript is a debrief describing a conversation that did not
 * happen, and a batch that aborted on its first bad row leaves forty-nine
 * learners' money locked up. None of those break a request. They are asserted
 * directly instead.
 *
 * Run with: npm run test:functions
 *   (or: export PATH="$HOME/.deno/bin:$PATH" && deno test --allow-all
 *        supabase/functions/tutor-session-reaper/)
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  settlement,
  TUTOR_REAP_AFTER_SECONDS,
} from "../_shared/tutor-pricing.ts";
import {
  EMPTY_ANALYSIS,
  type TutorAnalysis,
} from "../_shared/tutor-analysis.ts";
import type { BufferedTurn } from "../_shared/tutor-transcript-buffer.ts";
import {
  isStale,
  observedSecondsFor,
  reapAbandonedSessions,
  type ReapableSession,
  type ReaperDeps,
  SAFETY_EVENT_RETENTION_DAYS,
  type SettleClaim,
  settleFor,
  staleCutoffIso,
} from "./reap.ts";

// ─── Test doubles ─────────────────────────────────────────────────────────

/** A fixed clock. Every timestamp below is expressed relative to it. */
const NOW = Date.parse("2026-09-06T12:00:00.000Z");

function agoIso(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString();
}

function session(over: Partial<ReapableSession> = {}): ReapableSession {
  return {
    id: "session-1",
    user_id: "user-1",
    target_language: "es",
    native_language: "en",
    level: "intermediate",
    cefr_level: "B1",
    correction_mode: "as_you_go",
    granted_seconds: 600,
    granted_cents: 121,
    started_at: agoIso(400),
    last_heartbeat_at: agoIso(100),
    observed_seconds: null,
    ...over,
  };
}

interface Calls {
  claims: {
    id: string;
    observed: number;
    refundSeconds: number;
    refundCents: number;
  }[];
  transcriptReads: string[];
  analyses: string[];
  writeBacks: { id: string; observed: number }[];
  analysisFailures: string[];
  closes: { id: string; observed: number }[];
  drops: string[];
  sweeps: string[];
}

interface FakeOptions {
  rows?: ReapableSession[];
  /**
   * When false the fake returns every row regardless of the cutoff, which is
   * how the defensive `isStale` re-check gets exercised. Defaults to true: the
   * fake applies `last_heartbeat_at < cutoff` exactly as the SQL does.
   */
  applyCutoff?: boolean;
  claim?: (id: string) => SettleClaim["status"];
  alreadyObserved?: number;
  transcript?: (id: string) => { turns: BufferedTurn[]; available: boolean };
  analyzeThrows?: string;
  analysisAttempts?: number;
  alreadyAnalyzed?: string[];
  closeError?: string;
  listStaleError?: string;
  sweepError?: string;
  sweepDeleted?: number;
  terminateStatus?: "ended" | "busy" | "failed";
  /** Milliseconds the clock advances on each `now()` after the first. Used to
   *  drive the wall-clock budget deterministically. */
  clockStepMs?: number;
}

function fakeDeps(opts: FakeOptions = {}): { deps: ReaperDeps; calls: Calls } {
  const calls: Calls = {
    claims: [],
    transcriptReads: [],
    analyses: [],
    writeBacks: [],
    analysisFailures: [],
    closes: [],
    drops: [],
    sweeps: [],
  };

  let ticks = 0;

  const deps: ReaperDeps = {
    now() {
      const t = NOW + ticks * (opts.clockStepMs ?? 0);
      ticks += 1;
      return t;
    },

    listStale(cutoffIso, limit) {
      if (opts.listStaleError) {
        return Promise.reject(new Error(opts.listStaleError));
      }
      const rows = opts.rows ?? [];
      const filtered = opts.applyCutoff === false
        ? rows
        : rows.filter((r) =>
          Date.parse(r.last_heartbeat_at) < Date.parse(cutoffIso)
        );
      return Promise.resolve(filtered.slice(0, limit));
    },

    terminateProvider() {
      return Promise.resolve(opts.terminateStatus ?? "ended");
    },

    settleSession(sessionId, _userId, wanted) {
      calls.claims.push({
        id: sessionId,
        observed: wanted.observedSeconds,
        refundSeconds: wanted.refundSeconds,
        refundCents: wanted.refundCents,
      });
      const status = opts.claim ? opts.claim(sessionId) : "settled";
      return Promise.resolve(
        status === "error" ? { status } : {
          status,
          observedSeconds:
            status === "already" && opts.alreadyObserved !== undefined
              ? opts.alreadyObserved
              : wanted.observedSeconds,
        },
      );
    },

    readTranscript(sessionId) {
      calls.transcriptReads.push(sessionId);
      return Promise.resolve(
        opts.transcript ? opts.transcript(sessionId) : {
          turns: [{ speaker: "learner" as const, text: "hola qué tal" }],
          available: true,
        },
      );
    },

    analyze(s) {
      calls.analyses.push(s.id);
      if (opts.analyzeThrows) {
        return Promise.reject(new Error(opts.analyzeThrows));
      }
      return Promise.resolve(EMPTY_ANALYSIS as TutorAnalysis);
    },

    writeBack(s, _analysis, observedSeconds) {
      calls.writeBacks.push({ id: s.id, observed: observedSeconds });
      return Promise.resolve({
        alreadyAnalyzed: (opts.alreadyAnalyzed ?? []).includes(s.id),
      });
    },

    recordAnalysisFailure(sessionId) {
      calls.analysisFailures.push(sessionId);
      return Promise.resolve(opts.analysisAttempts ?? 1);
    },

    closeSession(sessionId, observedSeconds) {
      calls.closes.push({ id: sessionId, observed: observedSeconds });
      if (opts.closeError) return Promise.reject(new Error(opts.closeError));
      return Promise.resolve();
    },

    dropTranscript(sessionId) {
      calls.drops.push(sessionId);
      return Promise.resolve();
    },

    sweepSafetyEvents(cutoffIso) {
      calls.sweeps.push(cutoffIso);
      if (opts.sweepError) return Promise.reject(new Error(opts.sweepError));
      return Promise.resolve(opts.sweepDeleted ?? 0);
    },
  };

  return { deps, calls };
}

// ─── The stale window ─────────────────────────────────────────────────────
//
// This boundary IS the learner-visible cost of a force-kill, and it is wrong
// in both directions: too tight and a phone that briefly loses signal has its
// conversation settled out from under it; too loose and an abandoned session
// keeps a bigger slice of the learner's budget than it needed to.

Deno.test("staleCutoffIso is exactly TUTOR_REAP_AFTER_SECONDS behind now", () => {
  assertEquals(staleCutoffIso(NOW), agoIso(TUTOR_REAP_AFTER_SECONDS));
});

Deno.test("a session heartbeating 89s ago is not reaped; 91s ago is", async () => {
  const fresh = session({ id: "fresh", last_heartbeat_at: agoIso(89) });
  const stale = session({ id: "stale", last_heartbeat_at: agoIso(91) });

  // The fake applies the same `last_heartbeat_at < cutoff` predicate the SQL
  // does, so this exercises the cutoff arithmetic end to end.
  const { deps, calls } = fakeDeps({ rows: [fresh, stale] });
  const summary = await reapAbandonedSessions(deps);

  assertEquals(summary.scanned, 1);
  assertEquals(calls.closes.map((c) => c.id), ["stale"]);
  assertEquals(summary.reaped, 1);
  assertEquals(summary.errors, 0);
});

Deno.test("a session exactly at the boundary is left alone", () => {
  // `<` not `<=`, matching the SQL. At exactly 90s the learner may simply be
  // between heartbeats.
  const edge = session({ last_heartbeat_at: agoIso(TUTOR_REAP_AFTER_SECONDS) });
  assertEquals(isStale(edge, NOW), false);
  assertEquals(
    isStale(
      session({ last_heartbeat_at: agoIso(TUTOR_REAP_AFTER_SECONDS + 1) }),
      NOW,
    ),
    true,
  );
});

Deno.test("the provider deadline wins even when forged heartbeats continue", () => {
  const row = session({
    last_heartbeat_at: new Date(NOW).toISOString(),
    provider_connected_at: new Date(NOW - 600_000).toISOString(),
    provider_deadline_at: new Date(NOW).toISOString(),
    granted_seconds: 600,
  });
  assert(isStale(row, NOW));
  assertEquals(settleFor(row, NOW)?.observedSeconds, 600);
});

Deno.test("a live session slipping through the query is refused, not settled", async () => {
  // Guards the one bug in here that would be invisible AND expensive: a
  // `listStale` that stopped filtering would otherwise bill learners who are
  // still mid-conversation.
  const live = session({ id: "live", last_heartbeat_at: agoIso(5) });
  const { deps, calls } = fakeDeps({ rows: [live], applyCutoff: false });
  const summary = await reapAbandonedSessions(deps);

  assertEquals(summary.scanned, 1);
  assertEquals(calls.claims.length, 0);
  assertEquals(calls.closes.length, 0);
  assertEquals(summary.errors, 1);
});

// ─── The money ────────────────────────────────────────────────────────────

Deno.test("observed seconds are measured heartbeat-minus-start, never to now", () => {
  // 400s ago it started, 100s ago it last checked in: 300 seconds of provable
  // presence. The 100 seconds since are NOT billed — that is the entire point
  // of settling to the heartbeat.
  assertEquals(observedSecondsFor(session()), 300);
});

Deno.test("refunds match settlement() exactly", async () => {
  const s = session({ granted_seconds: 600, granted_cents: 121 });
  const expected = settlement(s.granted_seconds, s.granted_cents, 300);

  const { deps, calls } = fakeDeps({ rows: [s] });
  const summary = await reapAbandonedSessions(deps);

  assertEquals(calls.claims, [{
    id: s.id,
    observed: expected.observedSeconds,
    refundSeconds: expected.refundSeconds,
    refundCents: expected.refundCents,
  }]);
  assertEquals(summary.settled, 1);
  assertEquals(summary.settlementFailures, 0);
});

Deno.test("a session already settled by the end action is not refunded twice", async () => {
  const { deps, calls } = fakeDeps({
    rows: [session()],
    claim: () => "already",
    alreadyObserved: 120,
  });
  const summary = await reapAbandonedSessions(deps);

  assertEquals(summary.alreadySettled, 1);
  assertEquals(summary.settled, 0);
  // Still closed and still analysed: the money was someone else's job, the
  // learning half is still owed to the learner.
  assertEquals(calls.closes.length, 1);
  assertEquals(calls.writeBacks.length, 1);
  assertEquals(calls.closes[0].observed, 120);
  assertEquals(calls.writeBacks[0].observed, 120);
});

Deno.test("a claim that errors leaves the session entirely alone for the next tick", async () => {
  const { deps, calls } = fakeDeps({ rows: [session()], claim: () => "error" });
  const summary = await reapAbandonedSessions(deps);

  assertEquals(calls.closes.length, 0);
  assertEquals(summary.reaped, 0);
  assertEquals(summary.errors, 1);
  assertEquals(summary.settlementFailures, 1);
});

Deno.test("a failed provider hangup prevents settlement and close", async () => {
  const { deps, calls } = fakeDeps({
    rows: [session()],
    terminateStatus: "failed",
  });
  const summary = await reapAbandonedSessions(deps);
  assertEquals(calls.claims.length, 0);
  assertEquals(calls.closes.length, 0);
  assertEquals(summary.settled, 0);
  assertEquals(summary.errors, 1);
});

Deno.test("elapsed time beyond the grant is clamped, not stored raw", async () => {
  // started 700s ago, heartbeat 91s ago: 609 seconds of raw elapsed time
  // against a 600-second grant, because a client that ignored its own limit
  // keeps heartbeating past it. `settlement()` clamps to the grant, and the
  // CLAMPED figure is what must reach the database — `observed_seconds` is
  // what the spend ceiling reconciles against and what the debrief's "minutes
  // spoken" is derived from.
  const s = session({ started_at: agoIso(700), last_heartbeat_at: agoIso(91) });
  const { deps, calls } = fakeDeps({ rows: [s] });
  const summary = await reapAbandonedSessions(deps);

  assertEquals(calls.claims[0].observed, 600);
  assertEquals(calls.closes[0].observed, 600);
  assertEquals(calls.writeBacks[0].observed, 600);
  assertEquals(calls.claims[0].refundSeconds, 0);
  assertEquals(calls.claims[0].refundCents, 0);
  assertEquals(summary.settled, 1);
});

// ─── The learning ─────────────────────────────────────────────────────────

Deno.test("a lost buffer skips the analysis but still settles and closes", async () => {
  const { deps, calls } = fakeDeps({
    rows: [session()],
    transcript: () => ({ turns: [], available: false }),
  });
  const summary = await reapAbandonedSessions(deps);

  // No transcript is invented. A confident empty debrief would be
  // indistinguishable to the learner from a session where they said nothing.
  assertEquals(calls.analyses.length, 0);
  assertEquals(calls.writeBacks.length, 0);
  assertEquals(summary.lostBuffer, 1);
  // The money and the terminal state are unaffected — settlement must never
  // depend on the analysis half succeeding.
  assertEquals(summary.settled, 1);
  assertEquals(calls.claims.length, 1);
  assertEquals(summary.reaped, 1);
  // The key is deliberately left for its TTL rather than dropped: if Redis
  // merely blinked, a manual replay is still possible inside the grace window.
  assertEquals(calls.drops.length, 0);
});

Deno.test("an intact but empty buffer is distinguished from a lost one", async () => {
  const { deps, calls } = fakeDeps({
    rows: [session()],
    transcript: () => ({ turns: [], available: true }),
  });
  const summary = await reapAbandonedSessions(deps);

  assertEquals(summary.emptyTranscript, 1);
  assertEquals(summary.lostBuffer, 0);
  assertEquals(calls.analyses.length, 0);
  assertEquals(summary.reaped, 1);
});

Deno.test("alreadyAnalyzed is reported without a second write-back", async () => {
  const { deps, calls } = fakeDeps({
    rows: [session({ id: "raced" })],
    alreadyAnalyzed: ["raced"],
  });
  const summary = await reapAbandonedSessions(deps);

  assertEquals(summary.alreadyAnalyzed, 1);
  assertEquals(summary.analyzed, 0);
  // Exactly one call. The write-back owns its own `analyzed_at` claim; the
  // reaper must not build a second guard on top of it or retry around it.
  assertEquals(calls.writeBacks.length, 1);
  assertEquals(summary.reaped, 1);
});

Deno.test("the write-back is handed the server-measured seconds, not the grant", async () => {
  const { deps, calls } = fakeDeps({ rows: [session()] });
  await reapAbandonedSessions(deps);
  assertEquals(calls.writeBacks, [{ id: "session-1", observed: 300 }]);
});

Deno.test("skipAnalysis settles money but retains the learning work", async () => {
  const { deps, calls } = fakeDeps({ rows: [session()] });
  const summary = await reapAbandonedSessions(deps, { skipAnalysis: true });

  assertEquals(calls.transcriptReads.length, 0);
  assertEquals(calls.analyses.length, 0);
  assertEquals(summary.analysisSkipped, 1);
  assertEquals(summary.settled, 1);
  assertEquals(summary.reaped, 0);
  assertEquals(calls.closes.length, 0);
});

// ─── Ordering ─────────────────────────────────────────────────────────────

Deno.test("ended_at is written after the analysis, never before", async () => {
  // The close is what removes the row from this function's own queue. Writing
  // it first would mean a process that died mid-analysis lost that session's
  // corrections, evidence and cards with nothing to pick them back up.
  const order: string[] = [];
  const { deps } = fakeDeps({ rows: [session()] });

  const wrappedWriteBack = deps.writeBack.bind(deps);
  const wrappedClose = deps.closeSession.bind(deps);
  deps.writeBack = (s, a, o) => {
    order.push("writeBack");
    return wrappedWriteBack(s, a, o);
  };
  deps.closeSession = (id, o) => {
    order.push("close");
    return wrappedClose(id, o);
  };

  await reapAbandonedSessions(deps);
  assertEquals(order, ["writeBack", "close"]);
});

Deno.test("every session is settled before any is analysed", async () => {
  // Phase A before phase B. A batch that interleaved would leave the learners
  // at the back of the queue waiting on the LLM calls of everyone ahead of
  // them before getting their money back.
  const order: string[] = [];
  const rows = [
    session({ id: "a", last_heartbeat_at: agoIso(300) }),
    session({ id: "b", last_heartbeat_at: agoIso(200) }),
  ];
  const { deps } = fakeDeps({ rows });

  const settle = deps.settleSession.bind(deps);
  const analyze = deps.analyze.bind(deps);
  deps.settleSession = (id, userId, wanted) => {
    order.push(`settle:${id}`);
    return settle(id, userId, wanted);
  };
  deps.analyze = (s, t) => {
    order.push(`analyze:${s.id}`);
    return analyze(s, t);
  };

  await reapAbandonedSessions(deps);
  assertEquals(order, ["settle:a", "settle:b", "analyze:a", "analyze:b"]);
});

// ─── Failure isolation ────────────────────────────────────────────────────

Deno.test("one session throwing does not abort the batch", async () => {
  const rows = [
    session({ id: "a", last_heartbeat_at: agoIso(300) }),
    session({ id: "poison", last_heartbeat_at: agoIso(250) }),
    session({ id: "c", last_heartbeat_at: agoIso(200) }),
  ];
  const { deps, calls } = fakeDeps({
    rows,
    claim: (id) => {
      if (id === "poison") throw new Error("claim exploded");
      return "settled";
    },
  });

  const summary = await reapAbandonedSessions(deps);

  assertEquals(calls.closes.map((c) => c.id), ["a", "c"]);
  assertEquals(summary.reaped, 2);
  assertEquals(summary.errors, 1);
  // The sweep still runs. A bad row must not cost the retention policy its
  // tick either.
  assertEquals(calls.sweeps.length, 1);
});

Deno.test("an analysis failure remains open for a bounded retry", async () => {
  const { deps, calls } = fakeDeps({
    rows: [session()],
    analyzeThrows: "anthropic exploded",
  });
  const summary = await reapAbandonedSessions(deps);

  assertEquals(summary.errors, 1);
  assertEquals(summary.analysisRetries, 1);
  assertEquals(summary.reaped, 0);
  assertEquals(calls.closes.length, 0);
  assertEquals(calls.analysisFailures, ["session-1"]);
  // Not dropped: the transcript was never successfully consumed.
  assertEquals(calls.drops.length, 0);
});

Deno.test("analysis closes only after the durable retry limit is exhausted", async () => {
  const { deps, calls } = fakeDeps({
    rows: [session()],
    analyzeThrows: "anthropic exploded",
    analysisAttempts: 3,
  });
  const summary = await reapAbandonedSessions(deps);

  assertEquals(summary.analysisRetries, 0);
  assertEquals(summary.reaped, 1);
  assertEquals(calls.closes.length, 1);
  assertEquals(calls.drops.length, 0);
});

Deno.test("a close that fails leaves the session open and does not stop the batch", async () => {
  const rows = [
    session({ id: "a", last_heartbeat_at: agoIso(300) }),
    session({ id: "b", last_heartbeat_at: agoIso(200) }),
  ];
  const { deps, calls } = fakeDeps({ rows, closeError: "update failed" });
  const summary = await reapAbandonedSessions(deps);

  assertEquals(calls.closes.length, 2);
  assertEquals(summary.reaped, 0);
  assertEquals(summary.errors, 2);
  // Both were still settled exactly once; the next tick's claim will
  // short-circuit rather than refund them again.
  assertEquals(summary.settled, 2);
});

Deno.test("a failed scan does not skip the safety sweep", async () => {
  const { deps, calls } = fakeDeps({
    listStaleError: "postgrest down",
    sweepDeleted: 4,
  });
  const summary = await reapAbandonedSessions(deps);

  assertEquals(summary.scanned, 0);
  assertEquals(summary.errors, 1);
  assertEquals(calls.sweeps.length, 1);
  assertEquals(summary.safetyEventsDeleted, 4);
});

// ─── The safety sweep ─────────────────────────────────────────────────────

Deno.test("the safety sweep runs once per run, not once per session", async () => {
  const rows = [
    session({ id: "a", last_heartbeat_at: agoIso(300) }),
    session({ id: "b", last_heartbeat_at: agoIso(250) }),
    session({ id: "c", last_heartbeat_at: agoIso(200) }),
  ];
  const { deps, calls } = fakeDeps({ rows, sweepDeleted: 7 });
  const summary = await reapAbandonedSessions(deps);

  assertEquals(summary.reaped, 3);
  assertEquals(calls.sweeps.length, 1);
  assertEquals(summary.safetyEventsDeleted, 7);
});

Deno.test("the safety sweep runs even when nothing was reaped", async () => {
  const { deps, calls } = fakeDeps({ rows: [], sweepDeleted: 2 });
  const summary = await reapAbandonedSessions(deps);
  assertEquals(calls.sweeps.length, 1);
  assertEquals(summary.safetyEventsDeleted, 2);
});

Deno.test("the safety cutoff is 90 days back", async () => {
  const { deps, calls } = fakeDeps({ rows: [] });
  await reapAbandonedSessions(deps);
  assertEquals(
    calls.sweeps[0],
    new Date(NOW - SAFETY_EVENT_RETENTION_DAYS * 86_400_000).toISOString(),
  );
});

Deno.test("a failed sweep is reported and does not fail the run", async () => {
  const { deps, calls } = fakeDeps({
    rows: [session()],
    sweepError: "delete failed",
  });
  const summary = await reapAbandonedSessions(deps);

  assert(summary.safetySweepFailed);
  assertEquals(summary.reaped, 1);
  assertEquals(calls.closes.length, 1);
});

// ─── The wall clock ───────────────────────────────────────────────────────

Deno.test("the budget defers the learning half but never the money", async () => {
  const rows = [
    session({ id: "a", last_heartbeat_at: agoIso(300) }),
    session({ id: "b", last_heartbeat_at: agoIso(250) }),
    session({ id: "c", last_heartbeat_at: agoIso(200) }),
  ];
  // The clock advances on every `now()`, so the budget runs out partway
  // through phase B.
  const { deps, calls } = fakeDeps({ rows, clockStepMs: 1000 });
  const summary = await reapAbandonedSessions(deps, { analysisBudgetMs: 2000 });

  // All three settled — deferral must never delay a refund.
  assertEquals(summary.settled, 3);
  assertEquals(calls.claims.length, 3);
  // Only the ones that fitted were closed; the rest stay open with
  // `ended_at IS NULL` so the next tick finishes them.
  assert(summary.deferred > 0);
  assertEquals(summary.reaped + summary.deferred, 3);
});

Deno.test("the batch limit is passed through to the query", async () => {
  const rows = Array.from(
    { length: 5 },
    (_, i) => session({ id: `s${i}`, last_heartbeat_at: agoIso(300 - i) }),
  );
  const { deps, calls } = fakeDeps({ rows });
  const summary = await reapAbandonedSessions(deps, { limit: 2 });

  assertEquals(summary.scanned, 2);
  assertEquals(calls.closes.length, 2);
});
