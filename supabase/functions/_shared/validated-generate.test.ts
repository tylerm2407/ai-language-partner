// Deno tests for validated-generate.ts. Run with:
//   deno test supabase/functions/_shared/validated-generate.test.ts

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { generateValidated } from './validated-generate.ts';

Deno.test('safe content returns on first attempt, no fallback', async () => {
  let attempts = 0;
  let fallbackCalls = 0;
  const res = await generateValidated({
    fn: 'test',
    generate: (_n) => { attempts++; return Promise.resolve('Hello, how are you today?'); },
    fallback: () => { fallbackCalls++; return Promise.resolve('fallback text'); },
    language: 'en',
  });
  assertEquals(res.usedFallback, false);
  assertEquals(attempts, 1);
  assertEquals(fallbackCalls, 0);
  assertEquals(res.text, 'Hello, how are you today?');
});

Deno.test('unsafe content retries up to 2x, then uses fallback', async () => {
  let attempts = 0;
  let fallbackCalls = 0;
  const res = await generateValidated({
    fn: 'test',
    generate: (_n) => { attempts++; return Promise.resolve('this is fucking broken'); },
    fallback: () => { fallbackCalls++; return Promise.resolve('a clean fallback message'); },
    language: 'en',
    safetyRetries: 2,
  });
  assertEquals(res.usedFallback, true);
  assertEquals(attempts, 3); // safetyRetries (2) + 1 initial attempt
  assertEquals(fallbackCalls, 1);
  assertEquals(res.text, 'a clean fallback message');
});

Deno.test('retry that succeeds stops the loop early', async () => {
  let attempts = 0;
  let fallbackCalls = 0;
  const res = await generateValidated({
    fn: 'test',
    generate: (n) => {
      attempts++;
      // First attempt unsafe, second clean.
      if (n === 1) return Promise.resolve('total shit output');
      return Promise.resolve('recovered clean output');
    },
    fallback: () => { fallbackCalls++; return Promise.resolve('unused fallback'); },
    language: 'en',
    safetyRetries: 2,
  });
  assertEquals(res.usedFallback, false);
  assertEquals(attempts, 2);
  assertEquals(fallbackCalls, 0);
  assertEquals(res.text, 'recovered clean output');
});

Deno.test('provider failure retries, then uses the pre-authored fallback', async () => {
  let attempts = 0;
  let fallbackCalls = 0;
  const res = await generateValidated({
    fn: 'test',
    generate: (_n) => { attempts++; return Promise.reject(new Error('anthropic did not respond within 30000ms')); },
    fallback: () => { fallbackCalls++; return Promise.resolve('a clean fallback message'); },
    language: 'en',
    safetyRetries: 2,
  });
  assertEquals(res.usedFallback, true);
  assertEquals(res.fallbackReason, 'provider');
  assertEquals(attempts, 3);
  assertEquals(fallbackCalls, 1);
  assertEquals(res.text, 'a clean fallback message');
});

Deno.test('a provider failure that recovers on retry never reaches the fallback', async () => {
  let attempts = 0;
  let fallbackCalls = 0;
  const res = await generateValidated({
    fn: 'test',
    generate: (n) => {
      attempts++;
      if (n === 1) return Promise.reject(new Error('503 upstream'));
      return Promise.resolve('recovered clean output');
    },
    fallback: () => { fallbackCalls++; return Promise.resolve('unused fallback'); },
    language: 'en',
    safetyRetries: 2,
  });
  assertEquals(res.usedFallback, false);
  assertEquals(res.fallbackReason, undefined);
  assertEquals(attempts, 2);
  assertEquals(fallbackCalls, 0);
  assertEquals(res.text, 'recovered clean output');
});

Deno.test('a safety-exhausted fallback is still attributed to safety', async () => {
  const res = await generateValidated({
    fn: 'test',
    generate: (_n) => Promise.resolve('this is fucking broken'),
    fallback: () => Promise.resolve('a clean fallback message'),
    language: 'en',
    safetyRetries: 2,
  });
  assertEquals(res.usedFallback, true);
  assertEquals(res.fallbackReason, 'safety');
});

Deno.test('level validation is attached when targetLevel provided', async () => {
  const res = await generateValidated({
    fn: 'test',
    generate: () => Promise.resolve('I have a cat. The cat is black. I love my cat.'),
    fallback: () => Promise.resolve('fallback'),
    language: 'en',
    targetLevel: 'A1',
  });
  assert(res.validations.level !== undefined);
  assertEquals(typeof res.validations.level!.delta, 'number');
});

Deno.test('skipLevelCheck omits the level validation', async () => {
  const res = await generateValidated({
    fn: 'test',
    generate: () => Promise.resolve('hello world'),
    fallback: () => Promise.resolve('fallback'),
    language: 'en',
    targetLevel: 'A1',
    skipLevelCheck: true,
  });
  assertEquals(res.validations.level, undefined);
});
