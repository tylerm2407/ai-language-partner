/**
 * Unit tests for the call → debrief baton.
 *
 * The behaviour worth pinning is the session-id match. Two calls in a row
 * leave the first one's analysis in the slot while the second is still
 * running, and a debrief screen that rendered the PREVIOUS conversation's
 * mistakes would be wrong in the most convincing possible way — plausible,
 * specific, and about sentences the learner really did say, just not today.
 */

import {
  clearDebriefHandoff,
  peekDebrief,
  stashDebrief,
  type TutorDebriefHandoff,
} from './tutor-debrief-handoff';

function handoff(overrides: Partial<TutorDebriefHandoff> = {}): TutorDebriefHandoff {
  return {
    sessionId: 'sess-1',
    debrief: null,
    savedWords: [],
    minutes: 4,
    transcriptLost: false,
    transcript: [],
    ...overrides,
  };
}

beforeEach(() => {
  clearDebriefHandoff();
});

it('hands back what was stashed for the same session', () => {
  stashDebrief(handoff({ minutes: 7 }));
  expect(peekDebrief('sess-1')?.minutes).toBe(7);
});

it('holds nothing before a call has ended', () => {
  expect(peekDebrief('sess-1')).toBeNull();
});

it('refuses to hand one session the previous session analysis', () => {
  stashDebrief(handoff({ sessionId: 'sess-1', minutes: 7 }));
  expect(peekDebrief('sess-2')).toBeNull();
});

it('survives being read more than once', () => {
  // React renders a screen repeatedly. A baton that vanished on the second
  // read would flicker the debrief back to its loading state for no reason
  // the learner could see.
  stashDebrief(handoff());
  expect(peekDebrief('sess-1')).not.toBeNull();
  expect(peekDebrief('sess-1')).not.toBeNull();
  expect(peekDebrief('sess-1')).not.toBeNull();
});

it('keeps one slot only — the next call overwrites the last', () => {
  stashDebrief(handoff({ sessionId: 'sess-1' }));
  stashDebrief(handoff({ sessionId: 'sess-2' }));
  expect(peekDebrief('sess-1')).toBeNull();
  expect(peekDebrief('sess-2')).not.toBeNull();
});

it('drops everything when cleared', () => {
  stashDebrief(handoff());
  clearDebriefHandoff();
  expect(peekDebrief('sess-1')).toBeNull();
});
