// Deno tests for ./turn-policy.ts.
//
// Run with: `deno test supabase/functions/ai-chat/turn-policy.test.ts`
//
// Both governors are asymmetric on purpose, and that asymmetry is what these
// defend. Staying quiet is the default for the floor governor, because a
// permanent "be brief" is just a shorter prompt. Holding is the default for
// the push governor, because pushing someone who is struggling compounds the
// failure and raises the speaking anxiety the product exists to lower.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  FLOOR_SLACK,
  floorShareNote,
  LEARNER_FLOOR_TARGET,
  learnerFloorShare,
  PUSH_ACCURACY_CEILING,
  PUSH_MIN_SAMPLE,
  pushNote,
  selectPushStance,
  type PolicyMessage,
} from './turn-policy.ts';

const w = (n: number) => Array(n).fill('palabra').join(' ');

function convo(pairs: Array<[learner: number, tutor: number]>): PolicyMessage[] {
  const out: PolicyMessage[] = [];
  for (const [l, t] of pairs) {
    out.push({ role: 'user', content: w(l) });
    out.push({ role: 'assistant', content: w(t) });
  }
  return out;
}

// ─── Floor share ──────────────────────────────────────────────────────────

Deno.test('the floor is measured in words, not turns', () => {
  // A strictly alternating chat has equal turn counts by construction, so
  // counting turns would report a perfect balance while the tutor said three
  // times as much.
  const share = learnerFloorShare(convo([[10, 30], [10, 30]]));
  assertEquals(share, 20 / 80);
});

Deno.test('an empty conversation has no ratio, not a ratio of zero', () => {
  assertEquals(learnerFloorShare([]), null);
  assertEquals(learnerFloorShare([{ role: 'user', content: '   ' }]), null);
});

Deno.test('a dominated conversation is called out', () => {
  const note = floorShareNote(convo([[3, 40], [4, 45], [3, 50]]));
  assert(note !== null);
  assert(note!.includes('hand the floor straight back'));
  assert(note!.includes('%'), 'the learner share should be quoted back concretely');
});

Deno.test('a healthy balance says nothing at all', () => {
  // The common case. A governor that fires constantly is just a style.
  assertEquals(floorShareNote(convo([[30, 12], [28, 10], [35, 14]])), null);
});

Deno.test('a slight imbalance is inside the dead band', () => {
  // Just under target but within slack — a natural reply is often longer than
  // a beginner's turn, and clipping the tutor to nothing stops it modelling
  // the language, which is its other job.
  const justUnder = LEARNER_FLOOR_TARGET - FLOOR_SLACK + 0.02;
  const learner = Math.round(justUnder * 100);
  const note = floorShareNote(convo([[learner, 100 - learner], [learner, 100 - learner]]));
  assertEquals(note, null);
});

Deno.test('an opening exchange is too little to judge', () => {
  // Two messages is noise, and opening by scolding the tutor for talking
  // would be absurd.
  assertEquals(floorShareNote([
    { role: 'user', content: w(2) },
    { role: 'assistant', content: w(60) },
  ]), null);
});

// ─── Pushed output ────────────────────────────────────────────────────────

Deno.test('a comfortable learner gets stretched', () => {
  assertEquals(
    selectPushStance({ recentAccuracy: PUSH_ACCURACY_CEILING, sampleSize: PUSH_MIN_SAMPLE }),
    'stretch',
  );
});

Deno.test('a struggling learner is never pushed', () => {
  for (const acc of [0.2, 0.5, 0.69, 0.7, 0.84]) {
    assertEquals(
      selectPushStance({ recentAccuracy: acc, sampleSize: 50 }),
      'hold',
      `accuracy ${acc}`,
    );
  }
});

Deno.test('scoring exactly at the band pass mark is not coasting', () => {
  // 0.7 is the pass mark in lib/cefr-proficiency.ts. A learner sitting on it
  // is being appropriately challenged already.
  assertEquals(selectPushStance({ recentAccuracy: 0.7, sampleSize: 100 }), 'hold');
});

Deno.test('two lucky turns do not earn a push', () => {
  for (let n = 0; n < PUSH_MIN_SAMPLE; n++) {
    assertEquals(selectPushStance({ recentAccuracy: 1, sampleSize: n }), 'hold', `n=${n}`);
  }
});

Deno.test('no evidence means hold, never stretch', () => {
  assertEquals(selectPushStance({ recentAccuracy: null, sampleSize: 999 }), 'hold');
});

Deno.test('holding adds no instruction', () => {
  assertEquals(pushNote('hold', 'Spanish'), null);
});

Deno.test('stretching demands a harder FUNCTION, not harder tutor speech', () => {
  const note = pushNote('stretch', 'Spanish')!;
  // The demand goes on what the learner produces. Making the tutor harder to
  // follow is the opposite of pushed output — it degrades comprehensible input
  // while asking nothing more of the learner.
  assert(note.includes('keep your own Spanish at their level'));
  assert(note.includes('not on how hard you are to follow'));
  // Named functions, so the model has something concrete to ask for.
  assert(note.includes('speculate'));
  assert(note.includes('disagree'));
});

Deno.test('a failed stretch is not repeated', () => {
  assert(pushNote('stretch', 'Spanish')!.includes('do not push again this session'));
});
