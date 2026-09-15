/**
 * Unit tests for the client → wire end-reason narrowing.
 *
 * The failure this guards against is quiet: `endTutorSession` types
 * `endReason` as `string`, so sending a value the server does not recognise
 * compiles cleanly and settles a session — and real money — under a reason
 * nothing on the server has a branch for.
 */

import { wireEndReason, type WireEndReason } from './tutor-end-reason';
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

/** The set supabase/functions/tutor-session/end.ts actually accepts. */
const WIRE_VALUES: readonly WireEndReason[] = ['learner', 'budget', 'safety', 'timeout', 'error'];

it('only ever sends a value the server knows', () => {
  for (const reason of ALL_REASONS) {
    expect(WIRE_VALUES).toContain(wireEndReason(reason));
  }
});

it('settles a deliberate stop as the learner, not as a fault', () => {
  expect(wireEndReason('user_ended')).toBe('learner');
  // Declining the consent sheet and backgrounding the app are both a person
  // choosing to stop. Recording either as an error puts a fault in the record
  // for something nothing went wrong in.
  expect(wireEndReason('consent_declined')).toBe('learner');
  expect(wireEndReason('app_backgrounded')).toBe('learner');
});

it('distinguishes the daily allowance from the per-session ceiling', () => {
  // The server prices these differently — 'budget' is the one that means the
  // learner has none left.
  expect(wireEndReason('budget_exhausted')).toBe('budget');
  expect(wireEndReason('session_max')).toBe('timeout');
});

it('passes a safety stop through unchanged', () => {
  expect(wireEndReason('safety')).toBe('safety');
});

it('settles genuine faults as errors', () => {
  expect(wireEndReason('network_lost')).toBe('error');
  expect(wireEndReason('server_error')).toBe('error');
  // The microphone was granted at the lobby and then went away. That is a
  // failure, not a choice.
  expect(wireEndReason('permission_denied')).toBe('error');
});
