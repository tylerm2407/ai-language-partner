/**
 * Tests for the lesson-session snapshot contract.
 *
 * These guard the two properties the feature rests on: a snapshot expires one
 * day after the lesson STARTED (never rolling forward), and an untrusted
 * payload can't park unbounded data in Redis under a learner's key.
 *
 * Run with: npm run test:functions
 */
import { assert, assertEquals, assertNotEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  LESSON_SESSION_SCHEMA_VERSION,
  LESSON_SESSION_TTL_MS,
  MAX_ANSWER_TEXT_CHARS,
  MAX_SNAPSHOT_ANSWERS,
  lessonSessionRedisKey,
  parseSnapshot,
  remainingTtlSeconds,
} from './snapshot.ts';

function validSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    version: LESSON_SESSION_SCHEMA_VERSION,
    exerciseIndex: 3,
    answers: [{ exerciseId: 'ex-1', correct: true, answer: 'hola' }],
    picks: { 'ex-1': 'hola' },
    startedAt: Date.now(),
    ...overrides,
  };
}

Deno.test('lessonSessionRedisKey namespaces by user and lesson', () => {
  assertEquals(lessonSessionRedisKey('u1', 'l1'), 'lesson-session:u1:l1');
});

Deno.test('remainingTtlSeconds counts down from the lesson start', () => {
  const now = Date.now();
  // Just started → close to a full day.
  assertEquals(remainingTtlSeconds(now, now), Math.floor(LESSON_SESSION_TTL_MS / 1000));
  // An hour in → an hour less. Answering more questions cannot reset this.
  const hour = 60 * 60 * 1000;
  assertEquals(
    remainingTtlSeconds(now - hour, now),
    Math.floor((LESSON_SESSION_TTL_MS - hour) / 1000),
  );
  // Past its day → non-positive, which the handler turns into a delete.
  assertEquals(remainingTtlSeconds(now - LESSON_SESSION_TTL_MS - 1000, now) <= 0, true);
});

Deno.test('parseSnapshot accepts a well-formed snapshot', () => {
  const parsed = parseSnapshot(validSnapshot());
  assertNotEquals(parsed, null);
  assertEquals(parsed?.exerciseIndex, 3);
  assertEquals(parsed?.answers.length, 1);
  assertEquals(parsed?.picks['ex-1'], 'hola');
});

Deno.test('parseSnapshot defaults a missing pick map', () => {
  const { picks: _picks, ...withoutPicks } = validSnapshot();
  const parsed = parseSnapshot(withoutPicks);
  assertEquals(parsed?.picks, {});
});

Deno.test('parseSnapshot rejects malformed payloads', () => {
  assertEquals(parseSnapshot(null), null);
  assertEquals(parseSnapshot('nope'), null);
  assertEquals(parseSnapshot(validSnapshot({ version: 99 })), null);
  assertEquals(parseSnapshot(validSnapshot({ exerciseIndex: -1 })), null);
  assertEquals(parseSnapshot(validSnapshot({ exerciseIndex: 'x' })), null);
  assertEquals(parseSnapshot(validSnapshot({ answers: 'nope' })), null);
  assertEquals(parseSnapshot(validSnapshot({ startedAt: 0 })), null);
  assertEquals(parseSnapshot(validSnapshot({ answers: [{ exerciseId: 'e' }] })), null);
  assertEquals(parseSnapshot(validSnapshot({ picks: ['not', 'an', 'object'] })), null);
});

Deno.test('parseSnapshot rejects a startedAt in the future', () => {
  // Otherwise a caller could hand itself more than a day of resume time.
  assertEquals(parseSnapshot(validSnapshot({ startedAt: Date.now() + 60 * 60 * 1000 })), null);
});

Deno.test('parseSnapshot bounds what can be stored', () => {
  const tooMany = Array.from({ length: MAX_SNAPSHOT_ANSWERS + 1 }, (_, i) => ({
    exerciseId: `ex-${i}`,
    correct: true,
    answer: 'a',
  }));
  assertEquals(parseSnapshot(validSnapshot({ answers: tooMany })), null);

  const long = 'x'.repeat(MAX_ANSWER_TEXT_CHARS * 2);
  const parsed = parseSnapshot(
    validSnapshot({ answers: [{ exerciseId: 'ex-1', correct: true, answer: long }] }),
  );
  assertEquals(parsed?.answers[0].answer.length, MAX_ANSWER_TEXT_CHARS);
});

// ─── statuses ────────────────────────────────────────────────────────
// `answers` carries a plain boolean, so it cannot say "right on the second
// try" and has no row at all for a skip. Without these persisted, a resumed
// lesson would re-grade a recovered answer as correct and hand a skipped
// question back as unanswered — silently moving the learner's score.

function base(extra: Record<string, unknown> = {}) {
  return {
    version: 1,
    exerciseIndex: 2,
    answers: [{ exerciseId: 'ex1', correct: false, answer: 'leche' }],
    picks: { ex1: 'leche' },
    startedAt: Date.now() - 1000,
    ...extra,
  };
}

Deno.test('parseSnapshot round-trips per-exercise statuses', () => {
  const parsed = parseSnapshot(
    base({ statuses: { ex1: 'recovered', ex2: 'skipped', ex3: 'wrong' } }),
  );
  assert(parsed !== null);
  assertEquals(parsed!.statuses, { ex1: 'recovered', ex2: 'skipped', ex3: 'wrong' });
});

Deno.test('parseSnapshot defaults statuses to empty for an older client', () => {
  const parsed = parseSnapshot(base());
  assert(parsed !== null);
  assertEquals(parsed!.statuses, {});
});

Deno.test('parseSnapshot DROPS an unknown status rather than rejecting the session', () => {
  // A newer client adding a seventh status must not be able to wipe a
  // learner's in-flight lesson just by mentioning it.
  const parsed = parseSnapshot(
    base({ statuses: { ex1: 'correct', ex2: 'teleported', ex3: 42 } }),
  );
  assert(parsed !== null);
  assertEquals(parsed!.statuses, { ex1: 'correct' });
});

Deno.test('parseSnapshot rejects a statuses map that is not an object', () => {
  assertEquals(parseSnapshot(base({ statuses: ['correct'] })), null);
  assertEquals(parseSnapshot(base({ statuses: 'correct' })), null);
});

Deno.test('parseSnapshot bounds how many statuses can be parked in Redis', () => {
  const statuses: Record<string, string> = {};
  for (let i = 0; i < MAX_SNAPSHOT_ANSWERS + 1; i++) statuses[`ex${i}`] = 'correct';
  assertEquals(parseSnapshot(base({ statuses })), null);
});
