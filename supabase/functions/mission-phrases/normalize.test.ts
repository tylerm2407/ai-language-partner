// Deno tests for the warm-up phrase normaliser.
//
// Run with: `deno test supabase/functions/mission-phrases/normalize.test.ts`

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  MAX_MEANING_CHARS,
  MAX_PHRASES,
  MAX_PHRASE_CHARS,
  MIN_PHRASES,
  normalizePhrases,
} from './normalize.ts';

const FOUR = [
  { phrase: 'Una mesa para dos, por favor', meaning: 'A table for two, please' },
  { phrase: '¿Qué me recomienda?', meaning: 'What do you recommend?' },
  { phrase: 'Un agua, por favor', meaning: 'A water, please' },
  { phrase: '¿Cuánto cuesta?', meaning: 'How much is it?' },
];

Deno.test('the bounds are what the function header says', () => {
  assertEquals([MIN_PHRASES, MAX_PHRASES, MAX_PHRASE_CHARS, MAX_MEANING_CHARS], [4, 6, 80, 120]);
});

Deno.test('a clean JSON array passes through trimmed', () => {
  const raw = JSON.stringify(FOUR.map((p) => ({ phrase: `  ${p.phrase} `, meaning: ` ${p.meaning}\n` })));
  assertEquals(normalizePhrases(raw), FOUR);
});

Deno.test('code fences, a wrapping object and surrounding prose are all tolerated', () => {
  const body = JSON.stringify(FOUR);
  assertEquals(normalizePhrases('```json\n' + body + '\n```'), FOUR);
  assertEquals(normalizePhrases('```\n' + body + '\n```'), FOUR);
  assertEquals(normalizePhrases(JSON.stringify({ phrases: FOUR })), FOUR);
  assertEquals(normalizePhrases('Here are the phrases:\n' + body + '\nEnjoy!'), FOUR);
});

Deno.test('entries missing either half are dropped, not patched', () => {
  const raw = JSON.stringify([
    ...FOUR,
    { phrase: 'Gracias' },
    { meaning: 'Thanks' },
    { phrase: '', meaning: 'Thanks' },
    { phrase: 'Gracias', meaning: '   ' },
    'Gracias',
    null,
    42,
  ]);
  assertEquals(normalizePhrases(raw), FOUR);
});

Deno.test('over-long entries are dropped', () => {
  const raw = JSON.stringify([
    ...FOUR,
    { phrase: 'x'.repeat(MAX_PHRASE_CHARS + 1), meaning: 'too long a phrase' },
    { phrase: 'ok', meaning: 'y'.repeat(MAX_MEANING_CHARS + 1) },
    { phrase: 'a'.repeat(MAX_PHRASE_CHARS), meaning: 'b'.repeat(MAX_MEANING_CHARS) },
  ]);
  const out = normalizePhrases(raw);
  assertEquals(out.length, 5);
  assertEquals(out[4].phrase.length, MAX_PHRASE_CHARS);
});

Deno.test('duplicates are removed case-insensitively, first one wins', () => {
  const raw = JSON.stringify([
    ...FOUR,
    { phrase: '¿QUÉ ME RECOMIENDA?', meaning: 'shouted' },
    { phrase: 'La cuenta, por favor', meaning: 'The bill, please' },
  ]);
  const out = normalizePhrases(raw);
  assertEquals(out.length, 5);
  assertEquals(out[1].meaning, 'What do you recommend?');
});

Deno.test('the list is capped at six', () => {
  const eight = Array.from({ length: 8 }, (_, i) => ({ phrase: `frase ${i}`, meaning: `phrase ${i}` }));
  assertEquals(normalizePhrases(JSON.stringify(eight)).length, MAX_PHRASES);
});

Deno.test('unparseable input is an empty list, which the caller treats as unavailable', () => {
  assertEquals(normalizePhrases('I cannot help with that.'), []);
  assertEquals(normalizePhrases(''), []);
  assertEquals(normalizePhrases('{"phrase": "solo uno", "meaning": "just one"}'), []);
  assertEquals(normalizePhrases(undefined as unknown as string), []);
});
