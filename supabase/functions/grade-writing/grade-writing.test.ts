// Deno tests for grade-writing's pure grading helpers (grading.ts).
// Run with: deno test --allow-read --allow-env supabase/functions/grade-writing
//
// No network: the model is stubbed via the injected callModel function.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  buildFallbackFeedback,
  gradeWithValidation,
  parseGradingResponse,
  shouldRefundQuota,
} from './grading.ts';

Deno.env.set('OPENAI_KEY', 'sk-test');
const providerFetchForTest = globalThis.fetch;
globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
  String(input) === 'https://api.openai.com/v1/moderations'
    ? Promise.resolve(new Response(JSON.stringify({
        results: [{ flagged: false, categories: {} }],
      }), { status: 200 }))
    : providerFetchForTest(input, init)) as typeof fetch;

const VALID_GRADE = JSON.stringify({
  grammar: 18,
  vocabulary: 20,
  coherence: 17,
  task_completion: 22,
  total: 77,
  grammarScore: 72,
  vocabularyScore: 80,
  coherenceScore: 68,
  spellingScore: 90,
  sentenceStructureScore: 75,
  strengths: ['Good verb usage'],
  improvements: ['Watch gender agreement'],
  correctedVersion: 'Texto corregido.',
  corrections: [],
  overallFeedback: 'Solid work overall.',
});

const noopLog = () => {};

// ─── parseGradingResponse ────────────────────────────────────────────

Deno.test('parseGradingResponse: parses valid grading JSON and marks graded: true', () => {
  const parsed = parseGradingResponse(VALID_GRADE);
  assert(parsed !== null);
  assertEquals(parsed.graded, true);
  assertEquals(parsed.grammarScore, 72);
  assertEquals(parsed.overallFeedback, 'Solid work overall.');
});

Deno.test('parseGradingResponse: strips markdown code fences', () => {
  const parsed = parseGradingResponse('```json\n' + VALID_GRADE + '\n```');
  assert(parsed !== null);
  assertEquals(parsed.vocabularyScore, 80);
});

Deno.test('parseGradingResponse: extracts embedded JSON from surrounding prose', () => {
  const parsed = parseGradingResponse(`Here is the grade: ${VALID_GRADE} — good luck!`);
  assert(parsed !== null);
  assertEquals(parsed.coherenceScore, 68);
});

Deno.test('parseGradingResponse: returns null for non-JSON text', () => {
  assertEquals(parseGradingResponse('Sorry, I cannot grade this submission.'), null);
});

Deno.test('parseGradingResponse: returns null for JSON missing required score fields', () => {
  assertEquals(parseGradingResponse('{"overallFeedback": "nice"}'), null);
  assertEquals(parseGradingResponse('["not", "an", "object"]'), null);
  assertEquals(parseGradingResponse('null'), null);
});

Deno.test('parseGradingResponse: rejects out-of-range or incomplete rubric scores', () => {
  const valid = JSON.parse(VALID_GRADE);
  for (const change of [{ grammarScore: 101 }, { vocabularyScore: -1 }, { task_completion: 26 }, { spellingScore: '90' }]) {
    assertEquals(parseGradingResponse(JSON.stringify({ ...valid, ...change })), null);
  }
  delete valid.task_completion;
  assertEquals(parseGradingResponse(JSON.stringify(valid)), null);
});

Deno.test('parseGradingResponse: preserves zeros and calculates the rubric total', () => {
  const parsed = parseGradingResponse(JSON.stringify({ ...JSON.parse(VALID_GRADE), task_completion: 0, grammarScore: 0, total: 100 }));
  assert(parsed !== null);
  assertEquals(parsed.grammarScore, 0);
  assertEquals(parsed.task_completion, 0);
  assertEquals(parsed.total, 55);
});

Deno.test('fresh responses require every rubric, diagnostic and display field', () => {
  for (const key of [
    'grammar', 'vocabulary', 'coherence', 'task_completion',
    'grammarScore', 'vocabularyScore', 'coherenceScore', 'spellingScore', 'sentenceStructureScore',
    'strengths', 'improvements', 'correctedVersion', 'corrections', 'overallFeedback',
  ]) {
    const payload = JSON.parse(VALID_GRADE);
    delete payload[key];
    assertEquals(parseGradingResponse(JSON.stringify(payload)), null, `missing ${key}`);
  }
  const noRubric = JSON.parse(VALID_GRADE);
  for (const key of ['grammar', 'vocabulary', 'coherence', 'task_completion']) delete noRubric[key];
  assertEquals(parseGradingResponse(JSON.stringify(noRubric)), null, 'legacy compatibility must not waive a fresh task rubric');
  assertEquals(parseGradingResponse(JSON.stringify({ grammarScore: 80, vocabularyScore: 80, coherenceScore: 80 })), null);
});

Deno.test('fresh responses reject malformed data that the feedback screen cannot render safely', () => {
  const validCorrection = { original: 'yo es', corrected: 'yo soy', explanation: 'Match the subject.', type: 'grammar' };
  for (const change of [
    { strengths: 'Good writing' }, { strengths: [null] }, { improvements: [{}] },
    { correctedVersion: {} }, { overallFeedback: {} }, { overallFeedback: '  ' },
    { corrections: null }, { corrections: 'none' }, { corrections: [null] },
    { corrections: [{ ...validCorrection, original: {} }] },
    { corrections: [{ ...validCorrection, corrected: 1 }] },
    { corrections: [{ ...validCorrection, explanation: [] }] },
    { corrections: [{ ...validCorrection, type: ['grammar'] }] },
    { corrections: [{ ...validCorrection, type: 'unrecognized' }] },
    { corrections: [{ ...validCorrection, ruleViolated: {} }] },
    { graded: false }, { graded: 'true' },
  ]) assertEquals(parseGradingResponse(JSON.stringify({ ...JSON.parse(VALID_GRADE), ...change })), null);
});

Deno.test('fresh response validation preserves real zeros, empty advice and legitimate insertion/deletion corrections', () => {
  const zero = JSON.parse(VALID_GRADE);
  for (const key of ['grammar', 'vocabulary', 'coherence', 'task_completion', 'grammarScore', 'vocabularyScore', 'coherenceScore', 'spellingScore', 'sentenceStructureScore']) zero[key] = 0;
  const empty = parseGradingResponse(JSON.stringify({ ...zero, strengths: [], improvements: [], corrections: [], correctedVersion: null }));
  assert(empty !== null);
  assertEquals(empty.total, 0);
  assertEquals(empty.graded, true);
  assertEquals(empty.corrections, []);
  const corrections = [
    { original: '', corrected: 'a', explanation: 'Supply the preposition.', type: 'grammar' },
    { original: 'the', corrected: '', explanation: 'No article is needed here.', type: 'style', ruleViolated: 'Optional article guidance' },
    { original: 'a b', corrected: 'b a', explanation: 'Restore the required order.', type: 'structure' },
  ];
  assertEquals(parseGradingResponse(JSON.stringify({ ...JSON.parse(VALID_GRADE), corrections }))?.corrections, corrections);
});

// ─── buildFallbackFeedback ───────────────────────────────────────────

Deno.test('buildFallbackFeedback: no fake scores, flagged graded: false', () => {
  const fb = buildFallbackFeedback();
  assertEquals(fb.graded, false);
  for (const key of [
    'grammar', 'vocabulary', 'coherence', 'task_completion', 'total',
    'grammarScore', 'vocabularyScore', 'coherenceScore', 'spellingScore', 'sentenceStructureScore',
  ]) {
    assertEquals(fb[key], 0, `${key} must be 0 in the fallback, never a fabricated score`);
  }
  assert(
    String(fb.overallFeedback).toLowerCase().includes('unavailable'),
    'fallback must state that AI feedback is unavailable',
  );
});

// ─── shouldRefundQuota ───────────────────────────────────────────────

Deno.test('shouldRefundQuota: true for the no-grade fallback (graded: false)', () => {
  assertEquals(shouldRefundQuota(buildFallbackFeedback()), true);
});

Deno.test('shouldRefundQuota: false for a real grade (graded: true), even a low one', () => {
  const parsed = parseGradingResponse(VALID_GRADE);
  assert(parsed !== null);
  assertEquals(shouldRefundQuota(parsed), false);
  assertEquals(shouldRefundQuota({ graded: true, total: 0 }), false);
});

Deno.test('shouldRefundQuota: fallback from the orchestration path triggers a refund', async () => {
  const { feedback, fallbackReason } = await gradeWithValidation(
    () => Promise.resolve('not json at all'),
    noopLog,
  );
  assertEquals(feedback.graded, false);
  assertEquals(fallbackReason, 'parse');
  assertEquals(shouldRefundQuota(feedback, fallbackReason), true);
});

Deno.test('shouldRefundQuota: a safety fallback is NOT refunded — the submission drove it', async () => {
  // Every attempt echoes a flagged token back, so the safety budget is
  // exhausted and the honest fallback ships. Three paid calls happened.
  let calls = 0;
  const { feedback, fallbackReason } = await gradeWithValidation(() => {
    calls++;
    return Promise.resolve('{"correctedVersion":"visit http://example.com"}');
  }, noopLog);
  assertEquals(calls, 3);
  assertEquals(feedback.graded, false);
  assertEquals(fallbackReason, 'safety');
  assertEquals(shouldRefundQuota(feedback, fallbackReason), false);
});

// ─── gradeWithValidation orchestration ───────────────────────────────

Deno.test('gradeWithValidation: valid first response is returned as a real grade', async () => {
  let calls = 0;
  const { feedback: result } = await gradeWithValidation(() => {
    calls++;
    return Promise.resolve(VALID_GRADE);
  }, noopLog);
  assertEquals(calls, 1);
  assertEquals(result.graded, true);
  assertEquals(result.total, 77);
});

Deno.test('gradeWithValidation: parse failure retries once, then honest fallback', async () => {
  let calls = 0;
  const { feedback: result } = await gradeWithValidation(() => {
    calls++;
    return Promise.resolve('I could not produce JSON, sorry.');
  }, noopLog);
  // One generation per parse attempt (content is safe, so no safety retries).
  assertEquals(calls, 2);
  assertEquals(result.graded, false);
  assertEquals(result.grammarScore, 0);
  assertEquals(result.total, 0);
  assertEquals(result.correctedVersion, null);
});

Deno.test('gradeWithValidation: parse failure then valid retry returns the real grade', async () => {
  let calls = 0;
  const { feedback: result } = await gradeWithValidation(() => {
    calls++;
    return Promise.resolve(calls === 1 ? 'not json' : VALID_GRADE);
  }, noopLog);
  assertEquals(calls, 2);
  assertEquals(result.graded, true);
  assertEquals(result.grammarScore, 72);
});

Deno.test('incomplete fresh feedback retries and then uses honest no-grade fallback', async () => {
  let calls = 0;
  const { feedback: result, fallbackReason } = await gradeWithValidation(() => {
    calls++;
    return Promise.resolve(JSON.stringify({ grammarScore: 80, vocabularyScore: 80, coherenceScore: 80 }));
  }, noopLog);
  assertEquals(calls, 2);
  assertEquals(result.graded, false);
  assertEquals(result.corrections, []);
  assertEquals(fallbackReason, 'parse');
  assertEquals(shouldRefundQuota(result, fallbackReason), true);
});

Deno.test('gradeWithValidation: unsafe output exhausts safety retries, then fallback', async () => {
  let calls = 0;
  const { feedback: result, fallbackReason } = await gradeWithValidation(() => {
    calls++;
    return Promise.resolve('this essay is fucking terrible');
  }, noopLog);
  // generateValidated's budget: 1 initial + 2 safety retries.
  assertEquals(calls, 3);
  assertEquals(result.graded, false);
  assertEquals(result.grammarScore, 0);
  assertEquals(fallbackReason, 'safety');
});
