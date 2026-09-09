// Deno tests for the pure parts of _shared/tutor-calls.ts: the call-id parse
// and the one rule that decides whether a tutor refund is safe.

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { parseCallId, refundAllowed } from './tutor-calls.ts';

Deno.test('parseCallId: reads the id off the Location header shapes OpenAI uses', () => {
  assertEquals(parseCallId('/v1/realtime/calls/rtc_abc123'), 'rtc_abc123');
  assertEquals(parseCallId('https://api.openai.com/v1/realtime/calls/rtc_abc123/'), 'rtc_abc123');
  assertEquals(parseCallId('  /v1/realtime/calls/call-with_dash  '), 'call-with_dash');
});

Deno.test('parseCallId: anything else is null, never a guess', () => {
  assertEquals(parseCallId(''), null);
  assertEquals(parseCallId('/v1/realtime/sessions/sess_1'), null);
  assertEquals(parseCallId('/v1/realtime/calls/'), null);
  assertEquals(parseCallId('/v1/realtime/calls/rtc_1/hangup'), null);
});

Deno.test('refundAllowed: never connected → no call exists → refund', () => {
  assertEquals(refundAllowed({ connected_at: null, call_id: null }, null), true);
  // A call id with no connect timestamp cannot happen; if it did, the missing
  // connect still means nothing to end.
  assertEquals(refundAllowed({ connected_at: null, call_id: 'rtc_1' }, null), true);
});

Deno.test('refundAllowed: connected with a call id → only after a confirmed hangup', () => {
  const s = { connected_at: '2026-09-08T10:00:00Z', call_id: 'rtc_1' };
  assertEquals(refundAllowed(s, 'ended'), true);
  assertEquals(refundAllowed(s, 'failed'), false);
  assertEquals(refundAllowed(s, null), false);
});

Deno.test('refundAllowed: connected with NO call id → unhangable → forfeited', () => {
  const s = { connected_at: '2026-09-08T10:00:00Z', call_id: null };
  assertEquals(refundAllowed(s, null), false);
  assertEquals(refundAllowed(s, 'ended'), false);
});
