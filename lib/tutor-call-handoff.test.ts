/**
 * Unit tests for the lobby → call baton.
 *
 * The reason this module exists rather than a route param is that the object
 * it carries holds a `clientSecret`. The tests below pin the two behaviours
 * that follow from that: the slot is empty until a call is actually started
 * (so a cold deep link cannot find a credential), and it is emptied when the
 * call is done rather than left holding a spent one.
 */

import {
  clearCallHandoff,
  peekCallHandoff,
  stashCallHandoff,
} from './tutor-call-handoff';
import type { StartTutorSessionResult } from './tutor-api';

function session(overrides: Partial<StartTutorSessionResult> = {}): StartTutorSessionResult {
  return {
    sessionId: 'sess-1',
    clientSecret: 'ek_test',
    clientSecretExpiresAt: null,
    model: 'gpt-realtime',
    callsUrl: 'https://api.openai.com/v1/realtime/calls',
    grantedMs: 600_000,
    heartbeatIntervalSeconds: 20,
    correctionMode: 'as_you_go',
    personaId: 'mara',
    remainingTutorMinutesToday: 30,
    ...overrides,
  };
}

beforeEach(() => {
  clearCallHandoff();
});

it('holds nothing before a call is started', () => {
  // A cold deep link to /tutor/call must find no credential — the call screen
  // sends the learner back to the lobby rather than rendering nothing.
  expect(peekCallHandoff()).toBeNull();
});

it('hands the call screen the session the lobby minted', () => {
  stashCallHandoff(session({ sessionId: 'sess-9' }));
  expect(peekCallHandoff()?.sessionId).toBe('sess-9');
});

it('survives being read more than once', () => {
  stashCallHandoff(session());
  expect(peekCallHandoff()).not.toBeNull();
  expect(peekCallHandoff()).not.toBeNull();
});

it('keeps one slot only', () => {
  stashCallHandoff(session({ sessionId: 'sess-1' }));
  stashCallHandoff(session({ sessionId: 'sess-2' }));
  expect(peekCallHandoff()?.sessionId).toBe('sess-2');
});

it('stops holding a spent credential once cleared', () => {
  stashCallHandoff(session());
  clearCallHandoff();
  expect(peekCallHandoff()).toBeNull();
});
