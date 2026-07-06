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
  const result = await gradeWithValidation(
    () => Promise.resolve('not json at all'),
    noopLog,
  );
  assertEquals(result.graded, false);
  assertEquals(shouldRefundQuota(result), true);
});

// ─── gradeWithValidation orchestration ───────────────────────────────

Deno.test('gradeWithValidation: valid first response is returned as a real grade', async () => {
  let calls = 0;
  const result = await gradeWithValidation(() => {
    calls++;
    return Promise.resolve(VALID_GRADE);
  }, noopLog);
  assertEquals(calls, 1);
  assertEquals(result.graded, true);
  assertEquals(result.total, 77);
});

Deno.test('gradeWithValidation: parse failure retries once, then honest fallback', async () => {
  let calls = 0;
  const result = await gradeWithValidation(() => {
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
  const result = await gradeWithValidation(() => {
    calls++;
    return Promise.resolve(calls === 1 ? 'not json' : VALID_GRADE);
  }, noopLog);
  assertEquals(calls, 2);
  assertEquals(result.graded, true);
  assertEquals(result.grammarScore, 72);
});

Deno.test('gradeWithValidation: unsafe output exhausts safety retries, then fallback', async () => {
  let calls = 0;
  const result = await gradeWithValidation(() => {
    calls++;
    return Promise.resolve('this essay is fucking terrible');
  }, noopLog);
  // generateValidated's budget: 1 initial + 2 safety retries.
  assertEquals(calls, 3);
  assertEquals(result.graded, false);
  assertEquals(result.grammarScore, 0);
});
