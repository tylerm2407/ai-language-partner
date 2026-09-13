// Deno tests for the daily-news comprehension questions. Run with:
//   deno test --allow-read --allow-env supabase/functions/daily-news-cron/questions.test.ts
//
// Two contracts: the shape check is strict (the RPC grades blind against what
// is stored), and generation never throws (the article outlives the quiz).

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import type { ValidatedGenerateOpts, ValidatedResult } from '../_shared/validated-generate.ts';
import {
  MAX_OPTION_CHARS,
  generateQuestions,
  parseQuestions,
  validateQuestions,
} from './questions.ts';

function good(overrides: Partial<{ question: string; options: string[]; answer: number }> = {}) {
  return {
    question: '¿Dónde ocurre la historia?',
    options: ['En Madrid', 'En Lima', 'En Bogotá', 'En Quito'],
    answer: 1,
    ...overrides,
  };
}

const THREE = [good(), good({ question: '¿Cuándo?', answer: 0 }), good({ question: '¿Por qué?', answer: 3 })];

Deno.test('three well-formed questions pass, trimmed', () => {
  const r = validateQuestions([good({ question: '  ¿Qué pasó?  ' }), THREE[1], THREE[2]]);
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.questions.length, 3);
    assertEquals(r.questions[0].question, '¿Qué pasó?');
    assertEquals(r.questions[0].answer, 1);
  }
});

Deno.test('the { questions: [...] } envelope the prompt asks for is accepted', () => {
  assertEquals(validateQuestions({ questions: THREE }).ok, true);
});

Deno.test('two questions or four questions are rejected — the count is part of the contract', () => {
  assertEquals(validateQuestions(THREE.slice(0, 2)).ok, false);
  assertEquals(validateQuestions([...THREE, good()]).ok, false);
});

Deno.test('three options is rejected', () => {
  const r = validateQuestions([good({ options: ['a', 'b', 'c'] }), THREE[1], THREE[2]]);
  assertEquals(r.ok, false);
});

Deno.test('an empty option is rejected', () => {
  const r = validateQuestions([good({ options: ['a', '  ', 'c', 'd'] }), THREE[1], THREE[2]]);
  assertEquals(r.ok, false);
});

Deno.test('an option over the length cap is rejected', () => {
  const long = 'x'.repeat(MAX_OPTION_CHARS + 1);
  const r = validateQuestions([good({ options: [long, 'b', 'c', 'd'] }), THREE[1], THREE[2]]);
  assertEquals(r.ok, false);
  const atCap = 'y'.repeat(MAX_OPTION_CHARS);
  assertEquals(validateQuestions([good({ options: [atCap, 'b', 'c', 'd'] }), THREE[1], THREE[2]]).ok, true);
});

Deno.test('duplicate options are rejected — two right answers cannot be graded', () => {
  const r = validateQuestions([good({ options: ['En Lima', 'en lima', 'c', 'd'] }), THREE[1], THREE[2]]);
  assertEquals(r.ok, false);
});

Deno.test('answer must be an integer index into the options', () => {
  for (const answer of [4, -1, 1.5, NaN]) {
    assertEquals(validateQuestions([good({ answer }), THREE[1], THREE[2]]).ok, false, `answer ${answer}`);
  }
  const r = validateQuestions([good({ answer: '1' as unknown as number }), THREE[1], THREE[2]]);
  assertEquals(r.ok, false);
});

Deno.test('an empty question is rejected', () => {
  assertEquals(validateQuestions([good({ question: '' }), THREE[1], THREE[2]]).ok, false);
});

Deno.test('parseQuestions tolerates code fences and rejects non-JSON', () => {
  const fenced = '```json\n' + JSON.stringify({ questions: THREE }) + '\n```';
  assertEquals(parseQuestions(fenced).ok, true);
  assertEquals(parseQuestions('not json at all').ok, false);
});

// ── the cron branch: generation failure never loses the article ────────────

function passthrough(): (opts: ValidatedGenerateOpts) => Promise<ValidatedResult> {
  return async (opts) => {
    const text = await opts.generate(1);
    return { text, usedFallback: false, validations: { safety: { safe: true, reasons: [] } } };
  };
}

const INPUT = {
  article: { title: 'Título', content: 'Contenido del artículo.' },
  language: { code: 'es', name: 'Spanish' },
  band: 'B1' as const,
};

Deno.test('valid model output becomes questions', async () => {
  const logs: Record<string, unknown>[] = [];
  const q = await generateQuestions({
    ...INPUT,
    callModel: async () => JSON.stringify({ questions: THREE }),
    validated: passthrough(),
    log: (e) => logs.push(e),
  });
  assertEquals(q?.length, 3);
  assertEquals(logs.length, 0);
});

Deno.test('malformed model output → null, logged, not thrown', async () => {
  const logs: Record<string, unknown>[] = [];
  const q = await generateQuestions({
    ...INPUT,
    callModel: async () => JSON.stringify({ questions: THREE.slice(0, 1) }),
    validated: passthrough(),
    log: (e) => logs.push(e),
  });
  assertEquals(q, null);
  assertEquals(logs.length, 1);
  assertEquals(logs[0].evt, 'news_questions_skipped');
});

Deno.test('a safety/provider fallback → null, logged, not thrown', async () => {
  const logs: Record<string, unknown>[] = [];
  const q = await generateQuestions({
    ...INPUT,
    callModel: async () => 'irrelevant',
    validated: async (opts) => ({
      text: await opts.fallback(),
      usedFallback: true,
      fallbackReason: 'safety',
      validations: { safety: { safe: false, reasons: ['test'] } },
    }),
    log: (e) => logs.push(e),
  });
  assertEquals(q, null);
  assertEquals(logs[0].reason, 'fallback');
});

Deno.test('an exception out of the gate → null, logged, not thrown', async () => {
  const logs: Record<string, unknown>[] = [];
  const q = await generateQuestions({
    ...INPUT,
    callModel: async () => 'irrelevant',
    validated: async () => {
      throw new Error('boom');
    },
    log: (e) => logs.push(e),
  });
  assertEquals(q, null);
  assertEquals(logs[0].reason, 'boom');
});

Deno.test('the questions go through the gate at the article band and language', async () => {
  let seen: ValidatedGenerateOpts | null = null;
  await generateQuestions({
    ...INPUT,
    band: 'C1',
    callModel: async () => JSON.stringify({ questions: THREE }),
    validated: async (opts) => {
      seen = opts;
      return passthrough()(opts);
    },
  });
  assertEquals(seen!.targetLevel, 'C1');
  assertEquals(seen!.language, 'es');
});
