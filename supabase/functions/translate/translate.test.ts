// Deno tests for translate's pure orchestration (translate-core.ts).
// Run with: deno test --allow-read --allow-env supabase/functions/translate
//
// No network: the Anthropic call is stubbed via the injected callApi function.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { translateWithValidation } from './translate-core.ts';

const noopLog = () => {};

Deno.test('clean translation returns on the first attempt', async () => {
  let calls = 0;
  const outcome = await translateWithValidation(() => {
    calls++;
    return Promise.resolve('Hola, ¿cómo estás?');
  }, 'es', noopLog);
  assertEquals(calls, 1);
  assert(outcome.ok);
  assertEquals(outcome.translation, 'Hola, ¿cómo estás?');
});

Deno.test('unsafe output is rejected, retried once, then fails honestly', async () => {
  let calls = 0;
  const outcome = await translateWithValidation(() => {
    calls++;
    return Promise.resolve('esto es una mierda total');
  }, 'es', noopLog);
  assertEquals(calls, 2);
  assert(!outcome.ok);
  assertEquals(outcome.reason, 'unsafe');
});

Deno.test('unsafe first attempt, clean retry succeeds', async () => {
  let calls = 0;
  const outcome = await translateWithValidation(() => {
    calls++;
    return Promise.resolve(calls === 1 ? 'this is fucking broken' : 'This is broken.');
  }, 'en', noopLog);
  assertEquals(calls, 2);
  assert(outcome.ok);
  assertEquals(outcome.translation, 'This is broken.');
});

Deno.test('transient API failure retries once, then succeeds', async () => {
  let calls = 0;
  const outcome = await translateWithValidation(() => {
    calls++;
    if (calls === 1) return Promise.reject(new Error('Anthropic API error: 529 - overloaded'));
    return Promise.resolve('Bonjour!');
  }, 'fr', noopLog);
  assertEquals(calls, 2);
  assert(outcome.ok);
  assertEquals(outcome.translation, 'Bonjour!');
});

Deno.test('persistent API failure returns ok: false with api_error reason', async () => {
  let calls = 0;
  const outcome = await translateWithValidation(() => {
    calls++;
    return Promise.reject(new Error('Anthropic API error: 500 - boom'));
  }, 'fr', noopLog);
  assertEquals(calls, 2);
  assert(!outcome.ok);
  assertEquals(outcome.reason, 'api_error');
});
