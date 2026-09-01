// Deno tests for translate's pure orchestration (translate-core.ts).
// Run with: deno test --allow-read --allow-env supabase/functions/translate
//
// No network: the Anthropic call is stubbed via the injected callApi function.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  MAX_WORD_LOOKUP_CHARS,
  resolveQuotaCounter,
  translateWithValidation,
} from './translate-core.ts';

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

// ── resolveQuotaCounter (migration 094) ─────────────────────────────────────
// The client asks to be billed against the large `word_lookups` allowance by
// sending purpose: 'word_lookup'. These pin that the claim is checked rather
// than trusted — the whole reason the cheap counter is safe to offer.

Deno.test('no purpose bills the chat-sized translations counter', () => {
  const d = resolveQuotaCounter('Bonjour, comment allez-vous ?', undefined);
  assert(d.ok);
  assertEquals(d.counter, 'translations');
});

Deno.test('an unrecognised purpose bills translations, it does not fail open', () => {
  const d = resolveQuotaCounter('maison', 'something-else');
  assert(d.ok);
  assertEquals(d.counter, 'translations');
});

Deno.test('a single word bills word_lookups', () => {
  const d = resolveQuotaCounter('maison', 'word_lookup');
  assert(d.ok);
  assertEquals(d.counter, 'word_lookups');
});

Deno.test('elided, hyphenated and punctuated tokens are still one word', () => {
  for (const word of ["l'homme", 'sans-culotte', '¿qué?', 'Bundesausbildungsförderung']) {
    const d = resolveQuotaCounter(word, 'word_lookup');
    assert(d.ok, word);
    assertEquals(d.counter, 'word_lookups');
  }
});

Deno.test('a phrase claiming to be a word is refused, not silently rebilled', () => {
  // Rebilling it to `translations` would make the remaining count the client
  // shows the learner wrong, which is worse than an honest 400.
  const d = resolveQuotaCounter('la maison est grande', 'word_lookup');
  assert(!d.ok);
  assertEquals(d.code, 'NOT_A_WORD');
});

Deno.test('a newline or tab does not sneak a phrase past the check', () => {
  for (const text of ['la\nmaison', 'la\tmaison', 'la\u00a0maison']) {
    const d = resolveQuotaCounter(text, 'word_lookup');
    assert(!d.ok, text);
  }
});

Deno.test('input over the word cap is refused', () => {
  const tooLong = 'a'.repeat(MAX_WORD_LOOKUP_CHARS + 1);
  assert(!resolveQuotaCounter(tooLong, 'word_lookup').ok);
  assert(resolveQuotaCounter('a'.repeat(MAX_WORD_LOOKUP_CHARS), 'word_lookup').ok);
});

Deno.test('whitespace-only input is refused rather than billed', () => {
  assert(!resolveQuotaCounter('   ', 'word_lookup').ok);
});
