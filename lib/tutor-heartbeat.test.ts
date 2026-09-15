/**
 * Unit tests for the tutor heartbeat's decisions.
 *
 * WHAT THESE ARE FOR. The heartbeat is the only moderation pass on a live
 * speech-to-speech call, the only thing that fills the transcript buffer the
 * debrief and the SRS write-back are built from, and the only thing that keeps
 * `last_heartbeat_at` moving. All three fail SILENTLY: an unmoderated tutor
 * sounds like a tutor, an empty buffer produces a debrief screen that just
 * says it is still being written, and a stale liveness mark shows up as a
 * refund nobody asked for. Nothing here would be caught by using the app.
 *
 * The four that matter most, and each has a test that fails loudly:
 *   - a degraded response must change NOTHING (a flaky network must never
 *     end a working lesson),
 *   - a cut turn must leave the transcript (the learner did not hear it),
 *   - `terminate` must land on the right `TutorEndReason` (it is what the
 *     session is billed and filed under),
 *   - no heartbeat before connect or after end.
 */

import {
  DEFAULT_TUTOR_HEARTBEAT_SECONDS,
  NO_PENDING_TURNS,
  canReportTutorTurn,
  dropTutorTurns,
  hasPendingTurns,
  joinPendingText,
  tutorHeartbeatIntervalMs,
  tutorTerminateReason,
  tutorTurnOutcome,
} from './tutor-heartbeat';
import type { TutorPhase } from './realtime-session';
import type { TutorTurnResult } from './tutor-api';
import type { TranscriptState } from './tutor-transcript';

/** A healthy, entirely unremarkable heartbeat response. */
const OK: TutorTurnResult = {
  safe: true,
  cut: false,
  terminate: false,
  remainingMs: 300_000,
  degraded: false,
};

describe('tutorHeartbeatIntervalMs', () => {
  it('uses the interval the server named', () => {
    expect(tutorHeartbeatIntervalMs(20)).toBe(20_000);
  });

  it('falls back when the server said nothing', () => {
    expect(tutorHeartbeatIntervalMs(undefined)).toBe(DEFAULT_TUTOR_HEARTBEAT_SECONDS * 1000);
  });

  // Each of these is a bill rather than a crash, which is why they are pinned.
  // Zero or negative would spin the timer as fast as the event loop allows,
  // and every tick is a paid edge-function invocation plus a moderation call.
  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %p and falls back',
    (bad) => {
      expect(tutorHeartbeatIntervalMs(bad)).toBe(DEFAULT_TUTOR_HEARTBEAT_SECONDS * 1000);
    },
  );

  it('clamps a cadence slower than the reaper cares about', () => {
    expect(tutorHeartbeatIntervalMs(3_600)).toBe(120_000);
  });

  it('clamps a cadence fast enough to be a denial of service on ourselves', () => {
    expect(tutorHeartbeatIntervalMs(0.001)).toBe(1_000);
  });
});

describe('canReportTutorTurn', () => {
  /**
   * Exhaustive BY CONSTRUCTION. `Record<TutorPhase, ...>` means adding a phase
   * to the union stops this file compiling, which forces the decision to be
   * made here rather than defaulting to "no heartbeat" — the failure mode that
   * costs money and moderates nothing while looking completely fine.
   */
  const EXPECTED: Record<TutorPhase, boolean> = {
    idle: false,
    preflight: false,
    connecting: false,
    greeting: true,
    listening: true,
    tutor_speaking: true,
    interrupted: true,
    paused: true,
    reconnecting: true,
    ending: true,
    ended: false,
    error: false,
  };

  for (const [phase, allowed] of Object.entries(EXPECTED)) {
    it(`${allowed ? 'reports' : 'stays quiet'} in ${phase}`, () => {
      expect(canReportTutorTurn(phase as TutorPhase, 'sess-1')).toBe(allowed);
    });
  }

  it('never reports before the call has connected', () => {
    // The money case: advancing `last_heartbeat_at` during a dial that then
    // fails tells the reaper the learner was talking to a tutor they never
    // reached, and bills them for it.
    expect(canReportTutorTurn('idle', 'sess-1')).toBe(false);
    expect(canReportTutorTurn('preflight', 'sess-1')).toBe(false);
    expect(canReportTutorTurn('connecting', 'sess-1')).toBe(false);
  });

  it('never reports after the call has ended', () => {
    // The server answers a settled session with a 409.
    expect(canReportTutorTurn('ended', 'sess-1')).toBe(false);
  });

  it('keeps reporting through a pause and a reconnect', () => {
    // Non-obvious and deliberate: the peer connection is held open through
    // both, so OpenAI is still charging us, and the server bills wall clock.
    expect(canReportTutorTurn('paused', 'sess-1')).toBe(true);
    expect(canReportTutorTurn('reconnecting', 'sess-1')).toBe(true);
  });

  it('refuses without a session id, whatever the phase', () => {
    expect(canReportTutorTurn('listening', null)).toBe(false);
    expect(canReportTutorTurn('listening', '')).toBe(false);
  });
});

describe('tutorTerminateReason', () => {
  it('maps the two reasons the server actually sends', () => {
    expect(tutorTerminateReason('budget')).toBe('budget_exhausted');
    expect(tutorTerminateReason('safety')).toBe('safety');
  });

  it('calls an unrecognised reason a server error rather than guessing', () => {
    // Guessing `budget_exhausted` would tell a learner they ran out of time
    // when they did not, and would file the session under it permanently.
    expect(tutorTerminateReason(undefined)).toBe('server_error');
    expect(tutorTerminateReason('')).toBe('server_error');
    expect(tutorTerminateReason('vibes')).toBe('server_error');
  });
});

describe('tutorTurnOutcome', () => {
  it('does nothing at all on a healthy turn', () => {
    expect(tutorTurnOutcome(OK)).toEqual({
      cutPlayback: false,
      showRecovery: false,
      endReason: null,
    });
  });

  it('CHANGES NOTHING when the response is degraded', () => {
    // The single most important assertion in the file. `degraded` means the
    // round trip failed and every field is a default rather than an answer;
    // a bad network must not be able to cut, warn or hang up.
    const degraded: TutorTurnResult = {
      safe: false,
      cut: true,
      terminate: true,
      reason: 'safety',
      remainingMs: Number.NaN,
      degraded: true,
    };
    expect(tutorTurnOutcome(degraded)).toEqual({
      cutPlayback: false,
      showRecovery: false,
      endReason: null,
    });
  });

  it('cuts and offers a recovery when the tutor is refused', () => {
    expect(tutorTurnOutcome({ ...OK, safe: false, cut: true })).toEqual({
      cutPlayback: true,
      showRecovery: true,
      endReason: null,
    });
  });

  it('cuts on an unsafe verdict even if the server forgot to set `cut`', () => {
    // Dead today — `turn.ts` sets them together. Kept because the failure it
    // prevents is playing an unsafe turn, and the failure it risks is
    // scrubbing one we did not have to.
    expect(tutorTurnOutcome({ ...OK, safe: false }).cutPlayback).toBe(true);
  });

  it('maps a budget terminate to budget_exhausted', () => {
    expect(tutorTurnOutcome({ ...OK, terminate: true, reason: 'budget' })).toEqual({
      cutPlayback: false,
      showRecovery: false,
      endReason: 'budget_exhausted',
    });
  });

  it('maps a safety terminate to safety, and cuts the turn that caused it', () => {
    const result = tutorTurnOutcome({
      ...OK,
      safe: false,
      cut: true,
      terminate: true,
      reason: 'safety',
    });
    expect(result.endReason).toBe('safety');
    expect(result.cutPlayback).toBe(true);
  });

  it('skips the recovery line when the call is ending anyway', () => {
    // Reassuring a learner on a screen that is already navigating to the
    // debrief is noise.
    const result = tutorTurnOutcome({
      ...OK,
      cut: true,
      safe: false,
      terminate: true,
      reason: 'safety',
    });
    expect(result.showRecovery).toBe(false);
  });
});

describe('joinPendingText', () => {
  it('is empty for an empty batch', () => {
    expect(joinPendingText([])).toBe('');
  });

  it('drops blanks so an empty recogniser result is not reported as a turn', () => {
    expect(joinPendingText(['  ', '', 'Bonjour.'])).toBe('Bonjour.');
  });

  it('keeps a sentence boundary between batched turns', () => {
    // Run together, the moderation pass reads a word that was never said.
    expect(joinPendingText(['the end.', 'Now then...'])).toBe('the end.\nNow then...');
  });
});

describe('hasPendingTurns', () => {
  it('is false for the empty buffer', () => {
    expect(hasPendingTurns(NO_PENDING_TURNS)).toBe(false);
  });

  it('is true for a learner turn alone', () => {
    expect(hasPendingTurns({ tutor: [], learner: ['salut'] })).toBe(true);
  });

  it('is true for a tutor turn alone', () => {
    expect(hasPendingTurns({ tutor: [{ id: 'r1', text: 'salut' }], learner: [] })).toBe(true);
  });
});

describe('dropTutorTurns', () => {
  const state: TranscriptState = {
    turns: [
      { id: 'r1', role: 'tutor', text: 'Bonjour !', status: 'complete', fragments: [] },
      { id: 'i1', role: 'learner', text: 'Salut.', status: 'complete', fragments: [] },
      { id: 'r2', role: 'tutor', text: 'Refused.', status: 'complete', fragments: [] },
    ],
  };

  it('removes the cut turn and leaves everything else alone', () => {
    const next = dropTutorTurns(state, new Set(['r2']));
    expect(next.turns.map((turn) => turn.id)).toEqual(['r1', 'i1']);
  });

  it('removes a turn that is no longer the last one', () => {
    // The heartbeat is a round trip, so the learner has often spoken again by
    // the time the verdict lands. `truncateCurrentTutorTurn` only ever finds
    // the last STREAMING tutor turn, which by then is the wrong one or none.
    const next = dropTutorTurns(state, new Set(['r1']));
    expect(next.turns.map((turn) => turn.id)).toEqual(['i1', 'r2']);
  });

  it('never removes a learner turn that happens to share an id', () => {
    // The learner is never cut off for what they said — see `turn.ts`.
    const next = dropTutorTurns(state, new Set(['i1']));
    expect(next.turns.map((turn) => turn.id)).toEqual(['r1', 'i1', 'r2']);
  });

  it('returns the same object when nothing matched', () => {
    // By identity, so React re-renders nothing. The convention comes from
    // `lib/tutor-transcript.ts`.
    expect(dropTutorTurns(state, new Set(['nope']))).toBe(state);
    expect(dropTutorTurns(state, new Set())).toBe(state);
  });

  it('removes every turn in a batched cut', () => {
    const next = dropTutorTurns(state, new Set(['r1', 'r2']));
    expect(next.turns.map((turn) => turn.id)).toEqual(['i1']);
  });
});
