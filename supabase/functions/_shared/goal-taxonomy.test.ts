// Deno tests for the goal vocabulary and canonical key.
// Run: deno test --allow-read --allow-env supabase/functions/_shared/goal-taxonomy.test.ts

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  GOAL_DOMAINS,
  GOAL_SCENARIOS,
  MAX_SCENARIOS,
  REUSE_OVERLAP_THRESHOLD,
  goalKey,
  parseGoalShape,
  scenarioOverlap,
  type GoalShape,
} from './goal-taxonomy.ts';

const SHAPE: GoalShape = {
  domain: 'hospitality',
  scenarios: ['restaurant', 'cafe_bar'],
  register: 'informal',
};

Deno.test('the same goal always produces the same key', () => {
  assertEquals(goalKey('fr', SHAPE), goalKey('fr', { ...SHAPE }));
});

Deno.test('scenario order does not fragment the key', () => {
  // The mapper RANKS scenarios, but two learners who want the same three
  // situations must share a track whichever order the model listed them in.
  // Reuse is the whole cost control; a ranking-sensitive key would defeat it.
  const a = goalKey('fr', { ...SHAPE, scenarios: ['restaurant', 'cafe_bar'] });
  const b = goalKey('fr', { ...SHAPE, scenarios: ['cafe_bar', 'restaurant'] });
  assertEquals(a, b);
});

Deno.test('language, domain and register all change the key', () => {
  const base = goalKey('fr', SHAPE);
  assert(base !== goalKey('es', SHAPE));
  assert(base !== goalKey('fr', { ...SHAPE, domain: 'travel' }));
  assert(base !== goalKey('fr', { ...SHAPE, register: 'formal' }));
});

Deno.test('the key is readable, so a support question can be answered', () => {
  assertEquals(goalKey('fr', SHAPE), 'fr:hospitality:cafe_bar+restaurant:informal');
});

Deno.test('parseGoalShape accepts a well-formed mapper result', () => {
  const parsed = parseGoalShape({
    domain: 'work',
    scenarios: ['job_interview', 'work_meeting'],
    register: 'formal',
  });
  assert(parsed);
  assertEquals(parsed.domain, 'work');
  assertEquals(parsed.scenarios.length, 2);
});

Deno.test('an invented domain is refused, not coerced to a default', () => {
  // A goal silently rewritten to `travel` because the model said `vacationing`
  // would build the wrong track AND look like it worked.
  assertEquals(parseGoalShape({ domain: 'vacationing', scenarios: ['restaurant'], register: 'neutral' }), null);
});

Deno.test('invented scenarios are dropped, and an all-invented list is refused', () => {
  const partly = parseGoalShape({
    domain: 'travel',
    scenarios: ['teleporting', 'directions'],
    register: 'neutral',
  });
  assert(partly);
  assertEquals(partly.scenarios, ['directions']);

  assertEquals(
    parseGoalShape({ domain: 'travel', scenarios: ['teleporting'], register: 'neutral' }),
    null,
  );
});

Deno.test('an invented register is refused', () => {
  assertEquals(parseGoalShape({ domain: 'travel', scenarios: ['directions'], register: 'jocular' }), null);
});

Deno.test('duplicate scenarios collapse and the list is capped', () => {
  const parsed = parseGoalShape({
    domain: 'social',
    scenarios: ['small_talk', 'small_talk', 'making_friends', 'dating', 'hosting'],
    register: 'informal',
  });
  assert(parsed);
  assertEquals(parsed.scenarios, ['small_talk', 'making_friends', 'dating']);
  assertEquals(parsed.scenarios.length, MAX_SCENARIOS);
});

Deno.test('junk input is refused rather than throwing', () => {
  for (const junk of [null, undefined, 'travel', 42, [], {}]) {
    assertEquals(parseGoalShape(junk), null);
  }
});

Deno.test('overlap is 1 for identical sets and 0 for disjoint ones', () => {
  assertEquals(scenarioOverlap(['restaurant', 'cafe_bar'], ['cafe_bar', 'restaurant']), 1);
  assertEquals(scenarioOverlap(['restaurant'], ['gaming']), 0);
  assertEquals(scenarioOverlap([], ['gaming']), 0);
});

Deno.test('two of three shared scenarios clears the reuse threshold', () => {
  // Someone wanting {restaurant, cafe_bar, small_talk} is well served by a
  // track built for {restaurant, cafe_bar, shopping} — reusing it is the point.
  const overlap = scenarioOverlap(
    ['restaurant', 'cafe_bar', 'small_talk'],
    ['restaurant', 'cafe_bar', 'shopping'],
  );
  assert(overlap >= REUSE_OVERLAP_THRESHOLD, `overlap ${overlap}`);
});

Deno.test('one of three shared scenarios does NOT clear it', () => {
  // Otherwise a learner who asked about job interviews gets a coffee track.
  const overlap = scenarioOverlap(
    ['job_interview', 'presentation', 'negotiation'],
    ['job_interview', 'restaurant', 'shopping'],
  );
  assert(overlap < REUSE_OVERLAP_THRESHOLD, `overlap ${overlap}`);
});

Deno.test('the vocabulary stays small enough for keys to actually collide', () => {
  // Every scenario added multiplies the number of distinct keys and divides
  // the chance two learners share one. This test is a tripwire on growth, not
  // a style rule.
  assert(GOAL_DOMAINS.length <= 20, `${GOAL_DOMAINS.length} domains`);
  assert(GOAL_SCENARIOS.length <= 40, `${GOAL_SCENARIOS.length} scenarios`);
});

Deno.test('scenario names shared with the chat taxonomy match exactly', async () => {
  // So a goal track and the chat role-play for the same situation can be tied
  // together later without a translation layer.
  const { SCENARIOS } = await import('./scenarios.ts');
  const shared = Object.keys(SCENARIOS).filter((k) =>
    (GOAL_SCENARIOS as readonly string[]).includes(k),
  );
  assert(shared.length >= 6, `only ${shared.length} shared: ${shared.join(', ')}`);
});
