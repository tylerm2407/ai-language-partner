/**
 * Unit tests for the tutor screens' decisions.
 *
 * The rule under test throughout is the one from the module header: no
 * terminal state is a dead end. Every `TutorEndReason` resolves to somewhere
 * the learner can act, and the two cases that are easy to get wrong — a call
 * that dropped after real conversation, and a call that dropped before any —
 * are pinned separately because they look identical to the state machine and
 * are not the same to a person who just spent nine minutes speaking Spanish.
 */

import {
  DEBRIEF_POLL_ATTEMPTS,
  LOW_BUDGET_MINUTES,
  callBudgetNotice,
  callClockAccessibilityLabel,
  debriefHref,
  destinationForEnd,
  formatCallClock,
  lowBudgetLine,
  debriefView,
  parseSessionIdParam,
  startBlockedReason,
  type CallEndOutcome,
  type DebriefViewInput,
} from './tutor-screen-flow';
import type { TutorDebrief } from '../types';
import type { TranscriptTurn } from './tutor-transcript';
import { assessTutorBudget } from './tutor-budget';
import type { TutorEndReason } from './realtime-session';

const ALL_REASONS: readonly TutorEndReason[] = [
  'user_ended',
  'budget_exhausted',
  'session_max',
  'network_lost',
  'permission_denied',
  'consent_declined',
  'app_backgrounded',
  'safety',
  'server_error',
];

function outcome(overrides: Partial<CallEndOutcome> = {}): CallEndOutcome {
  return { reason: 'user_ended', sessionId: 'sess-1', hadConversation: true, ...overrides };
}

describe('destinationForEnd', () => {
  it('never leaves the learner without a destination', () => {
    for (const reason of ALL_REASONS) {
      for (const hadConversation of [true, false]) {
        for (const sessionId of ['sess-1', null]) {
          const d = destinationForEnd(outcome({ reason, hadConversation, sessionId }));
          expect(['debrief', 'lobby', 'error']).toContain(d.kind);
        }
      }
    }
  });

  it('every error destination says something and offers a way out', () => {
    for (const reason of ALL_REASONS) {
      const d = destinationForEnd(outcome({ reason, hadConversation: false, sessionId: null }));
      if (d.kind !== 'error') continue;
      expect(d.copy.title.length).toBeGreaterThan(0);
      expect(d.copy.message.length).toBeGreaterThan(0);
      // Either you can try again, or we point somewhere that works. The one
      // shape that is not allowed is a message with neither.
      expect(d.retry || d.offerTextChat || reason === 'safety').toBe(true);
    }
  });

  it('sends an ordinary end to the debrief', () => {
    expect(destinationForEnd(outcome({ reason: 'user_ended' }))).toEqual({
      kind: 'debrief',
      sessionId: 'sess-1',
    });
  });

  it('debriefs a call that ran out of time — they still spoke', () => {
    expect(destinationForEnd(outcome({ reason: 'budget_exhausted' })).kind).toBe('debrief');
    expect(destinationForEnd(outcome({ reason: 'session_max' })).kind).toBe('debrief');
  });

  it('debriefs a call that dropped AFTER real conversation', () => {
    // The nine-minutes-of-Spanish case. The server has the transcript; losing
    // it to a dropped packet would be the bug, not the dropped packet.
    expect(destinationForEnd(outcome({ reason: 'network_lost' })).kind).toBe('debrief');
    expect(destinationForEnd(outcome({ reason: 'server_error' })).kind).toBe('debrief');
  });

  it('shows an error with a retry when the call dropped before anything was said', () => {
    const d = destinationForEnd(outcome({ reason: 'network_lost', hadConversation: false }));
    expect(d.kind).toBe('error');
    if (d.kind !== 'error') throw new Error('unreachable');
    expect(d.retry).toBe(true);
    // No TURN relay in this build: for a learner behind a hostile NAT, "try
    // again" alone is a lie.
    expect(d.offerTextChat).toBe(true);
  });

  it('does not offer a debrief when there is no session id to read one from', () => {
    expect(destinationForEnd(outcome({ sessionId: null })).kind).toBe('lobby');
  });

  it('does not offer a debrief for a call in which nothing was said', () => {
    expect(destinationForEnd(outcome({ hadConversation: false })).kind).toBe('lobby');
  });

  it('explains a denied microphone instead of failing silently', () => {
    const d = destinationForEnd(outcome({ reason: 'permission_denied' }));
    expect(d.kind).toBe('error');
    if (d.kind !== 'error') throw new Error('unreachable');
    expect(d.copy.title.toLowerCase()).toContain('microphone');
    expect(d.retry).toBe(true);
  });

  it('returns declined consent to the lobby without an error', () => {
    // They read the sheet and said no. Re-presenting it as a failure argues
    // with a decision they just made.
    expect(destinationForEnd(outcome({ reason: 'consent_declined' })).kind).toBe('lobby');
    expect(
      destinationForEnd(outcome({ reason: 'consent_declined', hadConversation: false })).kind,
    ).toBe('lobby');
  });

  it('offers neither retry nor text chat after a safety end', () => {
    const d = destinationForEnd(outcome({ reason: 'safety' }));
    expect(d.kind).toBe('error');
    if (d.kind !== 'error') throw new Error('unreachable');
    expect(d.retry).toBe(false);
    // Routing someone to the text tutor moments after the voice tutor stopped
    // them is routing around the stop.
    expect(d.offerTextChat).toBe(false);
  });
});

describe('debriefHref', () => {
  it('passes the id as a param rather than pasting it into a URL', () => {
    // expo-router does the escaping; nothing here hand-encodes a session id
    // into a query string.
    expect(debriefHref('a b&c')).toEqual({
      pathname: '/(app)/tutor/debrief',
      params: { sessionId: 'a b&c' },
    });
  });
});

describe('parseSessionIdParam', () => {
  it('reads a plain param', () => {
    expect(parseSessionIdParam('sess-1')).toBe('sess-1');
  });

  it('takes the first value when a param repeats', () => {
    // expo-router types every param as string | string[] because a URL may
    // legally repeat one. Passing the array through would query for an array.
    expect(parseSessionIdParam(['sess-1', 'sess-2'])).toBe('sess-1');
  });

  it('treats missing, empty and whitespace-only as absent', () => {
    expect(parseSessionIdParam(undefined)).toBeNull();
    expect(parseSessionIdParam('')).toBeNull();
    expect(parseSessionIdParam('   ')).toBeNull();
    expect(parseSessionIdParam([])).toBeNull();
  });

  it('trims a padded id rather than querying for the padding', () => {
    expect(parseSessionIdParam(' sess-1 ')).toBe('sess-1');
  });
});

describe('formatCallClock', () => {
  it('pads the seconds', () => {
    expect(formatCallClock(64_000)).toBe('1:04');
    expect(formatCallClock(600_000)).toBe('10:00');
    expect(formatCallClock(9_000)).toBe('0:09');
  });

  it('floors rather than rounds, so the clock never shows more than is left', () => {
    expect(formatCallClock(59_999)).toBe('0:59');
  });

  it('never renders NaN or a negative clock', () => {
    // A missing grant used to put "NaN:aN" in the call header.
    expect(formatCallClock(Number.NaN)).toBe('0:00');
    expect(formatCallClock(Number.POSITIVE_INFINITY)).toBe('0:00');
    expect(formatCallClock(-5_000)).toBe('0:00');
  });
});

describe('callClockAccessibilityLabel', () => {
  it('spells the units out — VoiceOver reads "3:04" as a time of day', () => {
    expect(callClockAccessibilityLabel(184_000)).toBe('3 minutes 4 seconds of tutor time left');
  });

  it('drops the minutes when there are none', () => {
    expect(callClockAccessibilityLabel(9_000)).toBe('9 seconds of tutor time left');
  });

  it('singularises', () => {
    expect(callClockAccessibilityLabel(61_000)).toBe('1 minute 1 second of tutor time left');
  });
});

describe('lowBudgetLine', () => {
  it('says nothing when the allowance is not worth mentioning', () => {
    // A learner with an hour a day does not need a meter on the screen.
    expect(lowBudgetLine(60)).toBeNull();
    expect(lowBudgetLine(LOW_BUDGET_MINUTES + 1)).toBeNull();
  });

  it('speaks up at the threshold', () => {
    expect(lowBudgetLine(LOW_BUDGET_MINUTES)).toContain(`${LOW_BUDGET_MINUTES} minutes`);
  });

  it('singularises, and names zero plainly', () => {
    expect(lowBudgetLine(1)).toBe('About 1 minute of tutor time left today.');
    expect(lowBudgetLine(0)).toBe('No tutor time left today.');
  });

  it('says nothing when the number is unknown or unusable', () => {
    expect(lowBudgetLine(null)).toBeNull();
    expect(lowBudgetLine(undefined)).toBeNull();
    expect(lowBudgetLine(Number.NaN)).toBeNull();
  });

  it('never mentions money', () => {
    // The server meters this in cents; the cents figure is our COST. See the
    // header of lib/tutor-budget.ts.
    for (const minutes of [0, 1, 5, LOW_BUDGET_MINUTES]) {
      const line = lowBudgetLine(minutes) ?? '';
      expect(line).not.toMatch(/[$£€¢]|cent|credit/i);
    }
  });
});

describe('callBudgetNotice', () => {
  const verdictAt = (remainingMs: number) =>
    assessTutorBudget({ grantedMs: 600_000, elapsedMs: 600_000 - remainingMs, tier: 'premium' });

  it('is silent early in the call', () => {
    expect(callBudgetNotice(verdictAt(400_000))).toBeNull();
  });

  it('shows the warning once the budget is short', () => {
    expect(callBudgetNotice(verdictAt(90_000))).not.toBeNull();
  });

  it('stays silent during connect, when elapsed reconstructs to the whole grant', () => {
    // The call screen does not measure elapsed time — it reconstructs it as
    // `grantedMs - remainingMs` from the hook. Between mount and `start()`
    // dispatching, the hook's `remainingMs` is still 0 while the grant is
    // already real, so elapsed reconstructs to the FULL grant and the verdict
    // comes back `shouldEnd`. The one way that could mislead a learner is a
    // false "1 minute left" while the call is still connecting. It does not:
    // shouldWarn is gated on !shouldEnd, so the banner degrades to silence.
    const grantedMs = 600_000;
    const duringConnect = assessTutorBudget({ grantedMs, elapsedMs: grantedMs - 0, tier: 'premium' });
    expect(duringConnect.shouldEnd).toBe(true);
    expect(callBudgetNotice(duringConnect)).toBeNull();
  });

  it('round-trips the reconstruction exactly, whichever ceiling is biting', () => {
    // `assessTutorBudget` uses elapsed only as `granted - elapsed`, so feeding
    // it `granted - remaining` returns `remaining` unchanged. That is what
    // makes the reconstruction safe even above the hook's 15-minute
    // wall-clock cap, where the reconstructed elapsed is a fiction.
    const grantedMs = 1_800_000; // 30 min: above the session cap, so the cap bites
    for (const remaining of [900_000, 120_000, 30_000, 0]) {
      const v = assessTutorBudget({ grantedMs, elapsedMs: grantedMs - remaining, tier: 'premium' });
      expect(v.remainingMs).toBe(remaining);
    }
  });

  it('does not un-latch the warning in the final minute', () => {
    // assessTutorBudget latches shouldWarn through the rest of the call so the
    // banner cannot vanish just as it matters most. This must not add a
    // ceiling of its own.
    expect(callBudgetNotice(verdictAt(30_000))).not.toBeNull();
    expect(callBudgetNotice(verdictAt(1_000))).not.toBeNull();
  });
});

describe('startBlockedReason', () => {
  const gate = { hasProfile: true, needsCorrectionMode: false, starting: false };

  it('allows a start when everything is known', () => {
    expect(startBlockedReason(gate)).toBeNull();
  });

  it('blocks until the first-launch question is answered', () => {
    // Not pre-selected, not defaulted. The mode is baked into the session
    // instructions at mint time — see lib/tutor-storage.ts.
    expect(startBlockedReason({ ...gate, needsCorrectionMode: true })).toBe('needs_correction_mode');
  });

  it('blocks while the profile is still loading', () => {
    expect(startBlockedReason({ ...gate, hasProfile: false })).toBe('no_profile');
  });

  it('reports an in-flight start ahead of everything else', () => {
    expect(startBlockedReason({ hasProfile: false, needsCorrectionMode: true, starting: true })).toBe(
      'starting',
    );
  });
});

describe('debriefView', () => {
  const debrief: TutorDebrief = {
    highlight: 'You said "no me acuerdo" without pausing.',
    patterns: [],
    reachFor: [],
    nextTime: 'Try telling a story in the past.',
    minutesSpoken: 8,
  };

  const turn: TranscriptTurn = {
    id: 't1',
    role: 'learner',
    text: 'Hola, ¿qué tal?',
    status: 'complete',
    fragments: [],
  };

  function view(overrides: Partial<DebriefViewInput> = {}) {
    return debriefView({
      sessionId: 'sess-1',
      debrief: null,
      transcript: [],
      attempts: 0,
      transcriptLost: false,
      ...overrides,
    });
  }

  it('always renders something — there is no empty branch', () => {
    for (const attempts of [0, 1, DEBRIEF_POLL_ATTEMPTS, 99]) {
      for (const transcriptLost of [true, false]) {
        for (const transcript of [[], [turn]]) {
          for (const sessionId of ['sess-1', null]) {
            const v = view({ attempts, transcriptLost, transcript, sessionId });
            expect(['loading', 'ready', 'transcript_only', 'unavailable', 'missing']).toContain(
              v.kind,
            );
          }
        }
      }
    }
  });

  it('shows the analysis the moment it is there', () => {
    expect(view({ debrief }).kind).toBe('ready');
  });

  it('waits while there are attempts left', () => {
    expect(view({ attempts: 0 }).kind).toBe('loading');
    expect(view({ attempts: DEBRIEF_POLL_ATTEMPTS - 1 }).kind).toBe('loading');
  });

  it('falls back to the transcript once the attempts are spent', () => {
    const v = view({ attempts: DEBRIEF_POLL_ATTEMPTS, transcript: [turn] });
    expect(v.kind).toBe('transcript_only');
  });

  it('stops waiting immediately when the server says the transcript is gone', () => {
    // transcriptLost beats the poll count: no analysis is coming, and making
    // the learner wait five seconds to be told what we knew on arrival is the
    // bug this ordering exists to prevent.
    const v = view({ attempts: 0, transcriptLost: true, transcript: [turn] });
    expect(v.kind).toBe('transcript_only');
  });

  it('says so plainly when there is neither an analysis nor a transcript', () => {
    expect(view({ attempts: DEBRIEF_POLL_ATTEMPTS }).kind).toBe('unavailable');
  });

  it('reports a missing session id rather than querying for it', () => {
    expect(view({ sessionId: null }).kind).toBe('missing');
    // Even with everything else in hand — there is nothing to trust it against.
    expect(view({ sessionId: null, debrief }).kind).toBe('missing');
  });
});
