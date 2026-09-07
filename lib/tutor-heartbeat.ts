/**
 * Every DECISION the tutor-call heartbeat makes, with none of the timers.
 *
 * `hooks/useRealtimeTutor.ts` states the rule this module exists to obey: the
 * hook drains an outbox, owns clocks, and holds no opinions. The heartbeat has
 * opinions — whether it may fire at all, whether a turn the server refused
 * must be scrubbed out of the transcript, which `TutorEndReason` a server-side
 * `terminate` really is — and every one of them is a pure function of data.
 * They live here so they can be checked without a microphone, a socket, or a
 * renderer, which is the same reason `lib/realtime-session.ts` and
 * `lib/tutor-transcript.ts` exist.
 *
 * ── WHAT THE HEARTBEAT ACTUALLY IS ──
 *
 * One edge-function call (`reportTutorTurn`, the `turn` action) doing three
 * unrelated jobs at once, which is why it is easy to think of it as only the
 * least important of them:
 *
 *   1. SAFETY. The `turn` action is where `checkTutorOutput` runs. It is the
 *      ONLY moderation pass on a live tutor call — a speech-to-speech session
 *      generates audio directly from the model, so there is no pre-generation
 *      gate to put it behind. CLAUDE.md rule 1 names this as the one exception
 *      to that gate. An unwired heartbeat is not a degraded tutor; it is an
 *      unmoderated one.
 *   2. THE TRANSCRIPT BUFFER. `_shared/tutor-transcript-buffer.ts` is filled
 *      here and nowhere else. The `end` action analyses whatever is in it, so
 *      an empty buffer means no SRS cards, no `conversation_evidence`, and no
 *      debrief — the entire learning loop, silently dead.
 *   3. LIVENESS. `last_heartbeat_at` is where `tutor-session-reaper` settles
 *      an abandoned session to. Never advancing it means every dropped call
 *      settles back to `started_at` and refunds in full, so we pay OpenAI for
 *      time we then decline to bill.
 *
 * Note the asymmetry that follows: a MISSED heartbeat costs us money and one
 * unmoderated turn, while a heartbeat that ends a working call costs the
 * learner their lesson. That is why `reportTutorTurn` cannot throw and why
 * `degraded` below decides nothing.
 */

import type { TutorTurnResult } from './tutor-api';
import type { TutorEndReason, TutorPhase } from './realtime-session';
import type { TranscriptState } from './tutor-transcript';

/**
 * Cadence when the server did not name one.
 *
 * The server returns 20 (`heartbeatIntervalSeconds` from the `start` action).
 * This is the floor for a client that got a malformed or missing value, and it
 * matches the fallback in `lib/tutor-api.ts` deliberately: two different
 * defaults for one cadence is how a client ends up heartbeating at a rate the
 * reaper's staleness window was not sized for.
 */
export const DEFAULT_TUTOR_HEARTBEAT_SECONDS = 20;

/**
 * Clamped, not trusted.
 *
 * A zero or negative interval spins the timer as fast as the event loop will
 * allow — every tick a paid edge-function invocation on a device that is also
 * carrying a live WebRTC stream. An absurdly long one silently disables the
 * liveness half. Neither shows up as an error anywhere; both show up on a
 * bill. The ceiling is two minutes because the reaper's staleness window is
 * measured in minutes, and a heartbeat slower than that is not a heartbeat.
 */
export function tutorHeartbeatIntervalMs(seconds: number | undefined): number {
  const raw = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? seconds
    : DEFAULT_TUTOR_HEARTBEAT_SECONDS;
  return Math.min(Math.max(raw, 1), 120) * 1000;
}

/**
 * May a heartbeat go out in this phase?
 *
 * Written as an exhaustive switch rather than a set membership test so that
 * adding a phase to `TutorPhase` fails the build here instead of silently
 * defaulting to "no heartbeat" — which is the failure mode that costs money
 * and moderates nothing, and which nobody would notice.
 *
 * The two ends are the ones that matter:
 *
 *   BEFORE CONNECT (`idle`, `preflight`, `connecting`) there is nothing to
 *   report and nothing to moderate. Worse, advancing `last_heartbeat_at`
 *   during a dial that then fails would tell the reaper the learner was
 *   talking to a tutor they never reached, and it would bill them for it.
 *
 *   AFTER `ended` the server has already settled the session, and the `turn`
 *   action answers a settled session with a 409. That is harmless — the
 *   client swallows it — but a call that ends while a heartbeat is in flight
 *   is the NORMAL case, not the odd one, so the guard is also re-checked when
 *   the response lands rather than only before it is sent.
 *
 * `paused` and `reconnecting` DO heartbeat, which is the non-obvious call.
 * The peer connection is held open through both — that is the entire point of
 * pausing rather than tearing down — so OpenAI is still charging us, and the
 * server bills wall clock from `started_at` regardless of what the client
 * counts as live. Going quiet through a two-minute phone call would hand the
 * reaper a stale mark and refund time we genuinely spent.
 */
export function canReportTutorTurn(phase: TutorPhase, sessionId: string | null): boolean {
  // No session row means nothing on the server to report against. Distinct
  // from the phase check: a session can be `connecting` with an id, and the
  // reducer can be past `idle` before one is assigned.
  if (!sessionId) return false;

  switch (phase) {
    case 'greeting':
    case 'listening':
    case 'tutor_speaking':
    case 'interrupted':
    case 'paused':
    case 'reconnecting':
    case 'ending':
      return true;
    case 'idle':
    case 'preflight':
    case 'connecting':
    case 'ended':
    case 'error':
      return false;
  }
}

/**
 * What the caller must DO about one turn result.
 *
 * Three independent consequences rather than one enum, because they genuinely
 * co-occur: the safety cut that trips `TUTOR_MAX_SAFETY_CUTS` comes back with
 * `cut` AND `terminate` set, and both have to happen.
 */
export interface TutorTurnOutcome {
  /**
   * Silence the tutor and scrub the turn. The learner must not hear it and
   * must not read it either — see `dropTutorTurns`.
   */
  readonly cutPlayback: boolean;
  /**
   * Tell the learner something neutral in place of the turn that vanished.
   * False when the call is ending anyway: a reassuring notice on a screen that
   * is already navigating away is noise.
   */
  readonly showRecovery: boolean;
  /** Hang up, with this reason. Null means carry on. */
  readonly endReason: TutorEndReason | null;
}

const NOTHING_TO_DO: TutorTurnOutcome = {
  cutPlayback: false,
  showRecovery: false,
  endReason: null,
};

/**
 * The server's `terminate` reason, in the reducer's vocabulary.
 *
 * `turn.ts` sends `'budget'` or `'safety'` and nothing else. The default is
 * `server_error` rather than a guess: a `terminate` with a reason we do not
 * recognise means the server and this client disagree about the protocol, and
 * "we do not know why the server hung up" is exactly what `server_error`
 * means. Guessing `budget_exhausted` would tell the learner they ran out of
 * time when they did not, and would file the session under the wrong end
 * reason for good.
 */
export function tutorTerminateReason(reason: string | undefined): TutorEndReason {
  switch (reason) {
    case 'budget':
      return 'budget_exhausted';
    case 'safety':
      return 'safety';
    default:
      return 'server_error';
  }
}

/**
 * Read one heartbeat response.
 *
 * A DEGRADED response decides nothing at all, and this is the single most
 * important line in the module. `degraded` means the round trip failed — a
 * timeout, a 502, aeroplane mode — and every field on it is a default rather
 * than an answer. Acting on those defaults would mean a flaky network reads as
 * "safe, do not cut, do not terminate" (harmless) OR, if the defaults were
 * ever chosen differently, as a hang-up. The call survives a failed heartbeat;
 * the reaper is the backstop. See `reportTutorTurn`'s header for what a missed
 * one actually costs.
 *
 * `!safe` is treated as a cut even when `cut` is false. Today the server sets
 * them together for the tutor's own words, so the extra condition is dead —
 * deliberately. If a future verdict ever marks a turn unsafe without setting
 * `cut`, the failure this prevents is playing it, and the failure it risks is
 * scrubbing a turn we did not have to. Those are not close.
 */
export function tutorTurnOutcome(result: TutorTurnResult): TutorTurnOutcome {
  if (result.degraded) return NOTHING_TO_DO;

  const cutPlayback = result.cut || !result.safe;
  const endReason = result.terminate ? tutorTerminateReason(result.reason) : null;

  return {
    cutPlayback,
    showRecovery: cutPlayback && endReason === null,
    endReason,
  };
}

/**
 * What the learner sees where a cut turn was.
 *
 * SHOWN, never spoken. Speaking a recovery line would mean either sending
 * prompt text over the data channel — which the header of
 * `lib/realtime-events.ts` forbids outright, because anything the client can
 * send, a reader of the bundle can rewrite into a jailbroken tutor — or
 * sending a `CUE:` control token, and the server's `instructions.ts` defines
 * no token for this. An undefined token is not inert: the model reads it out.
 *
 * Deliberately vague about WHY. A learner who is told which phrase tripped a
 * safety filter has been handed the outline of how to trip it again, and one
 * who is told nothing at all is left wondering whether the app is broken. This
 * says a reply was dropped and that the call is fine, which is true and is all
 * they need.
 */
export const TUTOR_SAFETY_RECOVERY_NOTICE =
  "Your tutor's last reply was skipped. Keep going — it's still listening.";

/**
 * A turn the learner heard, waiting to be reported.
 *
 * Buffered rather than sent immediately because a heartbeat is a network round
 * trip and turns do not wait for it. Dropping a turn that completed while a
 * report was in flight would mean a tutor turn that was never moderated and
 * never buffered for the debrief — the two things the heartbeat exists for.
 */
export interface PendingTutorTurns {
  /** Tutor turns, with the transcript ids they were rendered under. */
  readonly tutor: readonly { readonly id: string; readonly text: string }[];
  /** The learner's completed utterances, oldest first. */
  readonly learner: readonly string[];
}

export const NO_PENDING_TURNS: PendingTutorTurns = { tutor: [], learner: [] };

export function hasPendingTurns(pending: PendingTutorTurns): boolean {
  return pending.tutor.length > 0 || pending.learner.length > 0;
}

/**
 * Collapse a batch into the one `tutorText`/`learnerText` pair the `turn`
 * action accepts.
 *
 * Newline-joined so the safety check sees sentence boundaries rather than two
 * sentences run together — a moderation pass on `"...the end.Now then..."` is
 * reading a word that was never said. The batch is normally one turn; more
 * than one only happens when a turn completed inside the 12-second window of
 * an in-flight report.
 */
export function joinPendingText(parts: readonly string[]): string {
  return parts.map((part) => part.trim()).filter((part) => part.length > 0).join('\n');
}

/**
 * Remove cut tutor turns from the transcript.
 *
 * Keyed on ID, not on position, and this is the difference between working and
 * looking like it works. `truncateCurrentTutorTurn` in `lib/tutor-transcript.ts`
 * finds the last STREAMING tutor turn, which is right for a barge-in — that
 * happens while the turn is still arriving. A safety cut is not: the heartbeat
 * fires when the tutor's transcript COMPLETES, so by the time the verdict comes
 * back the turn is sealed as `complete`, and the learner may already have
 * spoken again after it. Truncating "the current turn" would either do nothing
 * or delete an innocent one.
 *
 * Returns the state unchanged BY IDENTITY when nothing matched, which is the
 * convention `lib/tutor-transcript.ts` established so React re-renders nothing
 * on a no-op.
 */
export function dropTutorTurns(
  state: TranscriptState,
  ids: ReadonlySet<string>,
): TranscriptState {
  if (ids.size === 0) return state;
  const kept = state.turns.filter((turn) => !(turn.role === 'tutor' && ids.has(turn.id)));
  if (kept.length === state.turns.length) return state;
  return { turns: kept };
}
