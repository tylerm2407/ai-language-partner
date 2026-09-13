// Deno tests for the mission pass rule and the debrief grouping.
//
// Run with: `deno test supabase/functions/ai-chat/mission-result.test.ts`
//
// The rule is stated in `.claude/rules/learning.md` ("Chat missions") and
// these are what make changing one without the other a failing test.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { getMission } from '../_shared/missions.ts';
import {
  MAX_CORRECTION_EXAMPLES,
  MISSION_PASS_ACCURACY,
  combineTurnScore,
  computeMissionResult,
  groupCorrections,
} from './mission-result.ts';

const MISSION = getMission('restaurant', 1)!;
const ALL_IDS = MISSION.objectives.map((o) => o.id);

Deno.test('the pass mark is the same 0.7 the CEFR report uses', () => {
  assertEquals(MISSION_PASS_ACCURACY, 0.7);
});

Deno.test('all objectives met and accuracy at the mark passes', () => {
  const r = computeMissionResult({
    mission: MISSION,
    objectivesMet: ALL_IDS,
    evidence: [{ accuracy: 0.7, intelligibility: null }, { accuracy: 0.7, intelligibility: null }],
  });
  assertEquals(r.passed, true);
  assertEquals(r.reason, null);
  assertEquals(r.accuracy, 0.7);
  assertEquals(r.scoredTurns, 2);
  assertEquals(r.objectives.map((o) => o.met), [true, true, true]);
  assertEquals(r.objectives.map((o) => o.id), ALL_IDS);
});

Deno.test('one objective missing fails with objectives_incomplete, even at perfect accuracy', () => {
  const r = computeMissionResult({
    mission: MISSION,
    objectivesMet: ALL_IDS.slice(1),
    evidence: [{ accuracy: 1, intelligibility: null }],
  });
  assertEquals(r.passed, false);
  assertEquals(r.reason, 'objectives_incomplete');
  assertEquals(r.objectives[0].met, false);
});

Deno.test('objectives complete but accuracy under the mark fails with accuracy_below_pass', () => {
  const r = computeMissionResult({
    mission: MISSION,
    objectivesMet: ALL_IDS,
    evidence: [{ accuracy: 0.9, intelligibility: null }, { accuracy: 0.4, intelligibility: null }],
  });
  assertEquals(r.passed, false);
  assertEquals(r.reason, 'accuracy_below_pass');
  assertEquals(r.accuracy, 0.65, 'rounded to four places, so float noise never reaches the row');
});

Deno.test('objectives incomplete is reported before accuracy when both fail', () => {
  const r = computeMissionResult({
    mission: MISSION,
    objectivesMet: [],
    evidence: [{ accuracy: 0.1, intelligibility: null }],
  });
  assertEquals(r.reason, 'objectives_incomplete');
});

Deno.test('zero scored turns: accuracy is null and the attempt passes on objectives alone', () => {
  // Tyler's rule. A1 turns are often under the evidence floor; no evidence is
  // not bad evidence.
  const passing = computeMissionResult({ mission: MISSION, objectivesMet: ALL_IDS, evidence: [] });
  assertEquals(passing.passed, true);
  assertEquals(passing.accuracy, null);
  assertEquals(passing.scoredTurns, 0);

  const failing = computeMissionResult({ mission: MISSION, objectivesMet: [], evidence: [] });
  assertEquals(failing.passed, false);
  assertEquals(failing.reason, 'objectives_incomplete');
  assertEquals(failing.accuracy, null);
});

Deno.test('a speaking row combines accuracy and intelligibility 0.5/0.5', () => {
  assertEquals(combineTurnScore({ accuracy: 1, intelligibility: 0.5 }), 0.75);
  assertEquals(combineTurnScore({ accuracy: 0.8, intelligibility: null }), 0.8);
  // PostgREST may hand numerics back as strings.
  assertEquals(combineTurnScore({ accuracy: '0.6', intelligibility: '1' }), 0.8);

  const r = computeMissionResult({
    mission: MISSION,
    objectivesMet: ALL_IDS,
    evidence: [
      { accuracy: 1, intelligibility: 0.5 }, // 0.75
      { accuracy: 0.5, intelligibility: null }, // 0.5
    ],
  });
  assertEquals(r.accuracy, 0.625);
  assertEquals(r.passed, false);
  assertEquals(r.reason, 'accuracy_below_pass');
});

Deno.test('ids the mission does not own are ignored, not counted', () => {
  const r = computeMissionResult({
    mission: MISSION,
    objectivesMet: [...ALL_IDS, 'not_an_objective'],
    evidence: [],
  });
  assertEquals(r.objectives.length, MISSION.objectives.length);
  assertEquals(r.passed, true);
});

Deno.test('accuracy is clamped into 0..1 so the stored row cannot violate its CHECK', () => {
  const r = computeMissionResult({
    mission: MISSION,
    objectivesMet: ALL_IDS,
    evidence: [{ accuracy: 7, intelligibility: null }],
  });
  assertEquals(r.accuracy, 1);
});

// ─── Grouping ─────────────────────────────────────────────────────────────

Deno.test('corrections group by error type, sorted by count then type', () => {
  const groups = groupCorrections([
    { error_type: 'tense', original: 'yo va', corrected: 'yo voy' },
    { error_type: 'gender', original: 'la problema', corrected: 'el problema' },
    { error_type: 'tense', original: 'ayer como', corrected: 'ayer comí' },
    { error_type: 'spelling', original: 'gracias', corrected: 'gracias' },
    { error_type: 'gender', original: 'un mesa', corrected: 'una mesa' },
  ]);
  assertEquals(groups.map((g) => [g.errorType, g.count]), [
    ['gender', 2],
    ['tense', 2],
    ['spelling', 1],
  ]);
  assertEquals(groups[0].examples, [
    { original: 'la problema', corrected: 'el problema' },
    { original: 'un mesa', corrected: 'una mesa' },
  ]);
});

Deno.test('examples are capped at three while the count keeps counting', () => {
  const rows = Array.from({ length: 6 }, (_, i) => ({
    error_type: 'grammar',
    original: `wrong ${i}`,
    corrected: `right ${i}`,
  }));
  const [group] = groupCorrections(rows);
  assertEquals(group.count, 6);
  assertEquals(group.examples.length, MAX_CORRECTION_EXAMPLES);
  assertEquals(group.examples[0], { original: 'wrong 0', corrected: 'right 0' });
});

Deno.test('rows the model did not quote come last, and a missing type is other', () => {
  const [group] = groupCorrections([
    { error_type: null, original: '', corrected: null },
    { error_type: null, original: 'a', corrected: 'b' },
  ]);
  assertEquals(group.errorType, 'other');
  assertEquals(group.count, 2);
  assertEquals(group.examples, [
    { original: 'a', corrected: 'b' },
    { original: '', corrected: '' },
  ]);
});

Deno.test('no corrections is an empty list', () => {
  assertEquals(groupCorrections([]), []);
});
