// Deno tests for grade-response's pure logic (grade-core.ts).
// Run with: deno test --allow-read --allow-env supabase/functions/grade-response
//
// No network: the provider is a closure, and the real generateValidated runs
// its local safety checks over whatever that closure returns.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  buildSystemPrompt,
  checkRequest,
  fixedVerdict,
  gradeResponse,
  MAX_ANSWER_CHARS,
  normalizeAnswer,
  parseVerdict,
  type GradeRequest,
} from './grade-core.ts';

const REQUEST: GradeRequest = {
  answer: 'Fui al cine con mi hermana.',
  key: 'Fui al cine con mi hermano.',
  alternatives: ['Ayer fui al cine.'],
  language: 'es',
  level: 'A2',
  kind: 'free_production',
  prompt: 'Write one sentence about what you did yesterday.',
};

const VERDICT_JSON = '{"verdict":"correct","reason":"Clear past tense and on topic.","normalized_answer":"Fui al cine con mi hermana."}';

function deps(overrides: Partial<Parameters<typeof gradeResponse>[1]> = {}) {
  const calls: { generate: number; reserve: number; resolve: number } = { generate: 0, reserve: 0, resolve: 0 };
  const d = {
    generate: () => { calls.generate++; return Promise.resolve(VERDICT_JSON); },
    reserveSemanticGrade: () => { calls.reserve++; return Promise.resolve(true); },
    // The real one reads the passage's course for a short answer. Stubbed to
    // echo the request's language so the ordering assertions below (resolve
    // before meter, neither before the fixed fast path) stay meaningful.
    resolveLanguage: (req: GradeRequest) => { calls.resolve++; return Promise.resolve(req.language || 'es'); },
    ...overrides,
  };
  return { d, calls };
}

// ── checkRequest ───────────────────────────────────────────────────────────

Deno.test('a well-formed body is accepted and trimmed', () => {
  const r = checkRequest({ ...REQUEST, answer: `  ${REQUEST.answer}  ` });
  assert(r.ok);
  assertEquals(r.request.answer, REQUEST.answer);
  assertEquals(r.request.kind, 'free_production');
});

Deno.test('an over-long answer is refused, never truncated', () => {
  const r = checkRequest({ ...REQUEST, answer: 'a'.repeat(MAX_ANSWER_CHARS + 1) });
  assert(!r.ok);
  assertEquals(r.error, 'Answer too long');
});

Deno.test('closed-set fields must be in their sets', () => {
  assert(!checkRequest({ ...REQUEST, language: 'Klingon' }).ok);
  assert(!checkRequest({ ...REQUEST, level: 'Z9' }).ok);
  assert(!checkRequest({ ...REQUEST, kind: 'multiple_choice' }).ok);
  assert(!checkRequest({ ...REQUEST, alternatives: [1] }).ok);
  assert(!checkRequest({ ...REQUEST, alternatives: new Array(11).fill('x') }).ok);
});

Deno.test('a missing key or answer is refused', () => {
  assert(!checkRequest({ ...REQUEST, key: '' }).ok);
  assert(!checkRequest({ ...REQUEST, answer: '   ' }).ok);
  assert(!checkRequest('nope').ok);
});

// ── normalizeAnswer / fixedVerdict ─────────────────────────────────────────

Deno.test('normalisation mirrors the client grader', () => {
  assertEquals(normalizeAnswer('  J’ai   FINI! '), "j'ai fini");
  assertEquals(normalizeAnswer('今日は学校に行きました。'), '今日は学校に行きました');
});

Deno.test('exact and accent-folded matches are correct without a provider call', () => {
  assertEquals(fixedVerdict('fui al cine con mi hermano', REQUEST.key, []).verdict, 'correct');
  assertEquals(fixedVerdict('Ayer fui al cine.', REQUEST.key, REQUEST.alternatives).verdict, 'correct');
  assertEquals(fixedVerdict('cafe', 'café', []).verdict, 'correct');
});

Deno.test('the fixed path has no typo tolerance — near misses go to the model', () => {
  assertEquals(fixedVerdict('fui al cine con mi hermana', REQUEST.key, []).verdict, 'incorrect');
});

// ── parseVerdict ───────────────────────────────────────────────────────────

Deno.test('a fenced or prose-wrapped JSON object still parses', () => {
  const fenced = '```json\n' + VERDICT_JSON + '\n```';
  const parsed = parseVerdict(`Sure! ${fenced}`);
  assert(parsed);
  assertEquals(parsed.verdict, 'correct');
  assertEquals(parsed.normalizedAnswer, 'Fui al cine con mi hermana.');
});

Deno.test('anything but the rubric shape is rejected', () => {
  assertEquals(parseVerdict('{"verdict":"great","reason":"x"}'), null);
  assertEquals(parseVerdict('{"verdict":"correct"}'), null);
  assertEquals(parseVerdict('{"verdict":"correct","reason":"   "}'), null);
  assertEquals(parseVerdict('not json at all'), null);
});

// ── buildSystemPrompt ──────────────────────────────────────────────────────

Deno.test('the system prompt quotes the key as reference and never the answer', () => {
  const p = buildSystemPrompt(REQUEST);
  assert(p.includes(REQUEST.key));
  assert(p.includes('Ayer fui al cine.'));
  assert(p.includes('A2'));
  assert(!p.includes(REQUEST.answer));
});

// ── gradeResponse ──────────────────────────────────────────────────────────

Deno.test('a fixed match returns before the meter or the provider is touched', async () => {
  const { d, calls } = deps();
  const r = await gradeResponse({ ...REQUEST, answer: 'FUI AL CINE CON MI HERMANO' }, d);
  assertEquals(r.verdict, 'correct');
  assert(r.verdict !== 'fallback' && r.source === 'fixed');
  assertEquals(calls.reserve, 0);
  assertEquals(calls.generate, 0);
});

Deno.test('a semantic verdict comes back labelled as such', async () => {
  const { d, calls } = deps();
  const r = await gradeResponse(REQUEST, d);
  assert(r.verdict !== 'fallback');
  assertEquals(r.source, 'semantic');
  assertEquals(r.reason, 'Clear past tense and on topic.');
  assertEquals(calls.reserve, 1);
  assertEquals(calls.generate, 1);
});

Deno.test('an exhausted meter yields the fixed verdict and no provider call', async () => {
  const { d, calls } = deps({ reserveSemanticGrade: () => Promise.resolve(false) });
  const r = await gradeResponse(REQUEST, d);
  assert(r.verdict === 'fallback');
  assertEquals(r.reason, 'quota');
  assertEquals(r.fixed.verdict, 'incorrect');
  assertEquals(calls.generate, 0);
});

Deno.test('a provider outage retries on the safety budget, then falls back honestly', async () => {
  const { d, calls } = deps({ generate: () => { calls.generate++; return Promise.reject(new Error('503')); } });
  const r = await gradeResponse(REQUEST, d);
  assert(r.verdict === 'fallback');
  assertEquals(r.reason, 'provider');
  assertEquals(calls.generate, 2); // safetyRetries 1 + the first attempt
});

Deno.test('an unparseable completion is retried, and a good second answer wins', async () => {
  let n = 0;
  const { d } = deps({
    generate: () => { n++; return Promise.resolve(n === 1 ? 'Looks fine to me!' : VERDICT_JSON); },
  });
  const r = await gradeResponse(REQUEST, d);
  assert(r.verdict !== 'fallback');
  assertEquals(r.source, 'semantic');
  assertEquals(n, 2);
});

Deno.test('unsafe model output never reaches the learner', async () => {
  const { d } = deps({
    generate: () => Promise.resolve('{"verdict":"incorrect","reason":"this is fucking wrong"}'),
  });
  const r = await gradeResponse(REQUEST, d);
  assert(r.verdict === 'fallback');
  assertEquals(r.reason, 'safety');
});

Deno.test('a partial verdict is passed through unchanged', async () => {
  const { d } = deps({
    generate: () => Promise.resolve('{"verdict":"partial","reason":"Right idea, but the verb should be past tense."}'),
  });
  const r = await gradeResponse(REQUEST, d);
  assert(r.verdict === 'partial');
});

/**
 * The grading language comes from the content, never from the caller: a reading
 * answer is judged in the language of its passage's course. The rubric marks a
 * right answer given in the wrong language incorrect, so guessing a language
 * would fail every correct answer to an older passage after a learner switches
 * target language. When the passage cannot be resolved we refuse to grade.
 */
Deno.test('an unresolvable passage language refuses to grade, and spends nothing', async () => {
  const { d, calls } = deps({ resolveLanguage: () => Promise.resolve(null) });
  const r = await gradeResponse({ ...REQUEST, kind: 'short_answer', language: '', passageId: 'aabbccdd-1111-3008-a001-000000000000' }, d);
  assertEquals(r.verdict, 'fallback');
  assert(r.verdict === 'fallback' && r.reason === 'language');
  assertEquals(calls.reserve, 0);
  assertEquals(calls.generate, 0);
});

Deno.test('a resolved passage language replaces whatever the caller sent', async () => {
  const seen: string[] = [];
  const { d } = deps({
    resolveLanguage: () => Promise.resolve('ja'),
    generate: (system: string) => { seen.push(system); return Promise.resolve(VERDICT_JSON); },
  });
  const r = await gradeResponse(
    { ...REQUEST, kind: 'short_answer', language: 'es', passageId: 'aabbccdd-6666-3008-a001-000000000000' },
    d,
  );
  assert(r.verdict !== 'fallback');
  assertEquals(seen.length, 1);
  assert(seen[0].includes('ja'), 'the resolved language reaches the rubric');
});

/** The fixed fast path must cost nothing, including no passage lookup. */
Deno.test('a keyed answer resolves no language at all', async () => {
  const { d, calls } = deps();
  const r = await gradeResponse({ ...REQUEST, kind: 'short_answer', answer: 'Fui al cine con mi hermano.', passageId: 'aabbccdd-1111-3008-a001-000000000000' }, d);
  assert(r.verdict !== 'fallback' && r.source === 'fixed');
  assertEquals(calls.resolve, 0);
});
