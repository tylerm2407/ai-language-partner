// Deno tests for ./queue.ts.
//
// Run with: `deno test supabase/functions/daily-news-audio-cron/queue.test.ts`
//
// The load-bearing property in this file is CONSERVATION: every row the queue
// query returns reaches exactly one outcome, and the counters sum to the
// number that went in. It is pinned here because the failure it guards
// against is invisible in production — the cron returns 200, the counters
// look plausible on their own, and the only symptom is that one language
// quietly has no podcast that day.
//
// This exists because a real run reported `rendered:0 skipped:0 failed:1`
// after two rows were queued, and nothing in the response made the missing
// row apparent. `queued` and `unaccounted` now make that arithmetic explicit.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { planQueue, reconcile, type QueueCandidate } from './queue.ts';

const STALE_BEFORE = '2026-08-25T17:00:00.000Z';
const FRESH = '2026-08-25T17:04:00.000Z'; // after the cutoff → still held
const DEAD = '2026-08-25T16:50:00.000Z'; // before the cutoff → reclaimable

function row(over: Partial<QueueCandidate> & { id: string }): QueueCandidate {
  return {
    language: 'es',
    audio_status: 'pending',
    audio_generated_at: null,
    ...over,
  };
}

const ACTIVE = new Set(['es']);

Deno.test('planQueue: conserves every candidate — attempt + skipped === input', () => {
  const candidates = [
    row({ id: 'a' }),
    row({ id: 'b', language: 'fr' }),
    row({ id: 'c', audio_status: 'generating', audio_generated_at: FRESH }),
    row({ id: 'd', audio_status: 'generating', audio_generated_at: DEAD }),
    row({ id: 'e', audio_status: 'failed' }),
  ];
  const plan = planQueue(candidates, ACTIVE, STALE_BEFORE);

  assertEquals(plan.attempt.length + plan.skipped.length, candidates.length);
  // And no row appears twice or vanishes.
  const seen = [...plan.attempt.map((r) => r.id), ...plan.skipped.map((s) => s.id)].sort();
  assertEquals(seen, ['a', 'b', 'c', 'd', 'e']);
});

Deno.test('planQueue: pending and failed are attempted, inactive languages are not', () => {
  const plan = planQueue(
    [row({ id: 'a' }), row({ id: 'b', audio_status: 'failed' }), row({ id: 'c', language: 'ja' })],
    ACTIVE,
    STALE_BEFORE,
  );
  assertEquals(plan.attempt.map((r) => r.id), ['a', 'b']);
  assertEquals(plan.skipped, [{ id: 'c', language: 'ja', reason: 'language-inactive' }]);
});

Deno.test('planQueue: a FRESH generating claim belongs to someone else', () => {
  const plan = planQueue(
    [row({ id: 'held', audio_status: 'generating', audio_generated_at: FRESH })],
    ACTIVE,
    STALE_BEFORE,
  );
  assertEquals(plan.attempt.length, 0);
  assertEquals(plan.skipped[0].reason, 'claim-held-by-another-runner');
});

Deno.test('planQueue: a STALE generating claim is reclaimed', () => {
  const plan = planQueue(
    [row({ id: 'dead', audio_status: 'generating', audio_generated_at: DEAD })],
    ACTIVE,
    STALE_BEFORE,
  );
  assertEquals(plan.attempt.map((r) => r.id), ['dead']);
  assertEquals(plan.skipped.length, 0);
});

Deno.test('planQueue: generating with no timestamp is reclaimable, not wedged forever', () => {
  // A claim that somehow lost its timestamp must not pin the row for good.
  const plan = planQueue(
    [row({ id: 'x', audio_status: 'generating', audio_generated_at: null })],
    ACTIVE,
    STALE_BEFORE,
  );
  assertEquals(plan.attempt.map((r) => r.id), ['x']);
});

Deno.test('planQueue: every skip carries a reason — no bare counts', () => {
  const plan = planQueue(
    [
      row({ id: 'a', language: 'de' }),
      row({ id: 'b', audio_status: 'generating', audio_generated_at: FRESH }),
    ],
    ACTIVE,
    STALE_BEFORE,
  );
  assertEquals(plan.skipped.length, 2);
  for (const s of plan.skipped) {
    assert(s.reason.length > 0, 'a skip without a reason is how a silent drop hides');
    assert(s.id.length > 0);
  }
});

Deno.test('planQueue: an empty queue plans nothing and conserves trivially', () => {
  const plan = planQueue([], ACTIVE, STALE_BEFORE);
  assertEquals(plan.attempt.length, 0);
  assertEquals(plan.skipped.length, 0);
});

Deno.test('planQueue: no active learners means nothing is rendered, with reasons', () => {
  const plan = planQueue([row({ id: 'a' }), row({ id: 'b' })], new Set<string>(), STALE_BEFORE);
  assertEquals(plan.attempt.length, 0);
  assertEquals(plan.skipped.map((s) => s.reason), ['language-inactive', 'language-inactive']);
});

Deno.test('reconcile: a balanced run', () => {
  assertEquals(reconcile({ queued: 5, rendered: 2, skipped: 2, failed: 1 }), {
    balanced: true,
    unaccounted: 0,
  });
  assertEquals(reconcile({ queued: 0, rendered: 0, skipped: 0, failed: 0 }), {
    balanced: true,
    unaccounted: 0,
  });
});

Deno.test('reconcile: catches the exact shape of the reported incident', () => {
  // Two rows queued, one accounted for. This is what the response looked
  // like when the missing article went unnoticed.
  const r = reconcile({ queued: 2, rendered: 0, skipped: 0, failed: 1 });
  assertEquals(r.balanced, false);
  assertEquals(r.unaccounted, 1);
});

Deno.test('reconcile: catches double-counting too, not just vanishing', () => {
  const r = reconcile({ queued: 1, rendered: 1, skipped: 1, failed: 0 });
  assertEquals(r.balanced, false);
  assertEquals(r.unaccounted, -1);
});

Deno.test('planQueue + reconcile: a full run always balances', () => {
  // Simulate the whole accounting path: plan, then give every attempted row
  // some terminal outcome, and assert the totals reconcile. This is the
  // property the cron depends on.
  const candidates = [
    row({ id: 'a' }),
    row({ id: 'b' }),
    row({ id: 'c', language: 'ko' }),
    row({ id: 'd', audio_status: 'generating', audio_generated_at: FRESH }),
    row({ id: 'e', audio_status: 'failed' }),
  ];
  const plan = planQueue(candidates, ACTIVE, STALE_BEFORE);

  let rendered = 0;
  let failed = 0;
  let skipped = plan.skipped.length;
  plan.attempt.forEach((_, i) => {
    // Round-robin the three ways an attempt can end, including losing the claim.
    if (i % 3 === 0) rendered += 1;
    else if (i % 3 === 1) failed += 1;
    else skipped += 1;
  });

  const r = reconcile({ queued: candidates.length, rendered, skipped, failed });
  assertEquals(r.unaccounted, 0);
  assertEquals(r.balanced, true);
});
