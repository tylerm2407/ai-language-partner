// Deno tests for score-pronunciation's pure scoring helpers (scoring.ts).
// Run with: deno test --allow-read --allow-env supabase/functions/score-pronunciation
//
// No network: calculatePronunciationScore is pure string logic.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { calculatePronunciationScore, levenshteinDistance } from './scoring.ts';

// ─── levenshteinDistance ─────────────────────────────────────────────

Deno.test('levenshteinDistance: identical, empty, and classic cases', () => {
  assertEquals(levenshteinDistance('abc', 'abc'), 0);
  assertEquals(levenshteinDistance('', 'abc'), 3);
  assertEquals(levenshteinDistance('abc', ''), 3);
  assertEquals(levenshteinDistance('kitten', 'sitting'), 3);
});

// ─── calculatePronunciationScore ─────────────────────────────────────

Deno.test('perfect match on expected text: 100, no matchedVariant, no errors', () => {
  const result = calculatePronunciationScore('hola amigo', 'hola amigo', ['buenos dias']);
  assertEquals(result.score, 100);
  assertEquals(result.matchedVariant, null);
  assertEquals(result.phonemeErrors, []);
  assertEquals(result.feedback, 'Excellent pronunciation!');
});

Deno.test('normalization: case and surrounding whitespace are ignored', () => {
  const result = calculatePronunciationScore('  HOLA ', 'Hola', []);
  assertEquals(result.score, 100);
  assertEquals(result.matchedVariant, null);
});

Deno.test('accepted variant that matches better wins and is reported', () => {
  // Expected "el gato" scores 85 against "un gato" (partial credit on el→un);
  // the accepted variant "un gato" scores 100 and must win.
  const result = calculatePronunciationScore('un gato', 'el gato', ['un gato']);
  assertEquals(result.score, 100);
  assertEquals(result.matchedVariant, 'un gato');
  assertEquals(result.phonemeErrors, []);
});

Deno.test('tie between expected text and a variant: expected wins (first in order)', () => {
  // Both "uno dos" (expected) and "uno tres" (variant) score 50 against
  // "uno zzzzzz" — deterministic rule: first in order wins, so the match
  // is the expected text and matchedVariant stays null.
  const result = calculatePronunciationScore('uno zzzzzz', 'uno dos', ['uno tres']);
  assertEquals(result.score, 50);
  assertEquals(result.matchedVariant, null);
  assertEquals(result.phonemeErrors, ['"dos" not recognized']);
});

Deno.test('tie between two accepted variants: earlier variant wins deterministically', () => {
  // Expected "aaa bbb" scores 0; variants "ccc ddd" and "ccc eee" both
  // score 50 against "ccc zzzzzz" — the earlier variant must be reported
  // regardless of insertion order quirks (regression for the old
  // double-assignment bug that made this order-dependent).
  const result = calculatePronunciationScore('ccc zzzzzz', 'aaa bbb', ['ccc ddd', 'ccc eee']);
  assertEquals(result.score, 50);
  assertEquals(result.matchedVariant, 'ccc ddd');
});

Deno.test('close pronunciation gets partial credit with a phoneme error', () => {
  // "pero" vs "perro": levenshtein 1 → 0.7 credit → 70.
  const result = calculatePronunciationScore('pero', 'perro', []);
  assertEquals(result.score, 70);
  assertEquals(result.phonemeErrors, ['"perro" heard as "pero"']);
  assertEquals(result.matchedVariant, null);
});

Deno.test('total miss: score 0 still reports per-word errors (init regression)', () => {
  // The old implementation initialized best-score to 0 and only updated on
  // a strictly greater score, so an all-wrong attempt returned NO phoneme
  // errors. The first variant now seeds the result.
  const result = calculatePronunciationScore('xxxxxx yyyyyy', 'perro grande', []);
  assertEquals(result.score, 0);
  assertEquals(result.phonemeErrors, [
    '"perro" not recognized',
    '"grande" not recognized',
  ]);
  assertEquals(result.matchedVariant, null);
  assert(result.feedback.startsWith('Needs improvement'));
});

Deno.test('the passing 60-74 band does not read like a failure', () => {
  // The learner is shown a plain "Sounded right" at >= 60, so prose in this
  // band that sounds like a fail contradicts the label above it. Supporting
  // detail may vary; the verdict may not.
  // Three of five words right, two unrecognisable => 3/5 = 60, the bottom of
  // the passing band and the worst case the label still calls a pass.
  const result = calculatePronunciationScore(
    'uno dos tres zzzzzzz yyyyyyy',
    'uno dos tres cuatro cinco',
    [],
  );
  if (result.score < 60 || result.score >= 75) {
    throw new Error(`fixture landed at ${result.score}, outside the 60-74 band`);
  }
  assert(!/decent|keep practicing|needs improvement/i.test(result.feedback),
    `passing-band feedback reads like a failure: "${result.feedback}"`);
});
