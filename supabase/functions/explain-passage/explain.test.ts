// Deno tests for explain-passage's pure logic (explain-core.ts).
// Run with: deno test --allow-read --allow-env supabase/functions/explain-passage
//
// No network: nothing here calls a provider.

import { assert, assertEquals, assertNotEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  buildExplainSystemPrompt,
  checkSpan,
  explanationCacheKey,
  MAX_SPAN_CHARS,
  MIN_SPAN_CHARS,
  normalizeSpan,
} from './explain-core.ts';

const PARAGRAPH =
  'Il y avait une fois un roi qui régnait sur un pays très lointain, et ce roi avait trois filles.';

// ── normalizeSpan ──────────────────────────────────────────────────────────
// This is what makes the cache shared rather than per-reader: imported
// Gutenberg text is hard-wrapped, so the same paragraph arrives carrying CRLFs
// at positions that mean nothing.

Deno.test('hard line wrapping does not change the canonical span', () => {
  const wrapped = 'Il y avait une fois un roi\r\nqui régnait sur un pays\r\ntrès lointain.';
  const unwrapped = 'Il y avait une fois un roi qui régnait sur un pays très lointain.';
  assertEquals(normalizeSpan(wrapped), unwrapped);
});

Deno.test('leading, trailing and doubled whitespace collapse', () => {
  assertEquals(normalizeSpan('  a   b \n\n c  '), 'a b c');
});

Deno.test('punctuation and capitalisation are preserved — they change meaning', () => {
  assertNotEquals(normalizeSpan('Allons-y !'), normalizeSpan('allons-y'));
});

// ── checkSpan ──────────────────────────────────────────────────────────────

Deno.test('a paragraph-sized span is accepted and comes back normalised', () => {
  const r = checkSpan(`  ${PARAGRAPH.replace(' roi ', ' roi\r\n')}  `);
  assert(r.ok);
  assertEquals(r.span, PARAGRAPH);
});

Deno.test('an over-long span is refused, never truncated', () => {
  // Truncating would present an explanation of half a paragraph as an
  // explanation of the whole one, which reads as the model being wrong.
  const r = checkSpan('a '.repeat(MAX_SPAN_CHARS));
  assert(!r.ok);
  assertEquals(r.code, 'SPAN_TOO_LONG');
});

Deno.test('a span at exactly the cap is accepted', () => {
  const r = checkSpan('a'.repeat(MAX_SPAN_CHARS));
  assert(r.ok);
});

Deno.test('a too-short span is refused — that is a word lookup', () => {
  const r = checkSpan('maison');
  assert(!r.ok);
  assertEquals(r.code, 'SPAN_TOO_SHORT');
});

Deno.test('length is measured after normalising, not before', () => {
  // Whitespace padding must not push an otherwise fine paragraph over the cap.
  const padded = `${'a'.repeat(MAX_SPAN_CHARS)}${'  \r\n  '}`;
  assert(checkSpan(padded).ok);
  assert(MIN_SPAN_CHARS < MAX_SPAN_CHARS);
});

// ── explanationCacheKey ────────────────────────────────────────────────────

Deno.test('the key is deterministic', async () => {
  const a = await explanationCacheKey('fr', 'en', 'B1', PARAGRAPH);
  const b = await explanationCacheKey('fr', 'en', 'B1', PARAGRAPH);
  assertEquals(a, b);
  assertEquals(a.length, 64);
});

Deno.test('every component of the key changes it', async () => {
  const base = await explanationCacheKey('fr', 'en', 'B1', PARAGRAPH);
  assertNotEquals(base, await explanationCacheKey('es', 'en', 'B1', PARAGRAPH));
  assertNotEquals(base, await explanationCacheKey('fr', 'es', 'B1', PARAGRAPH));
  // The same paragraph genuinely needs a different explanation at A2 and C1.
  assertNotEquals(base, await explanationCacheKey('fr', 'en', 'A2', PARAGRAPH));
  assertNotEquals(base, await explanationCacheKey('fr', 'en', 'B1', `${PARAGRAPH}!`));
});

Deno.test('the key does not depend on which book the span came from', async () => {
  // Two editions of the same novel, and a reading_passages row quoting it,
  // must resolve to one row and be generated once. There is no book id in the
  // signature at all — this test exists so adding one is a deliberate act.
  const a = await explanationCacheKey('fr', 'en', 'B1', PARAGRAPH);
  const b = await explanationCacheKey('fr', 'en', 'B1', PARAGRAPH);
  assertEquals(a, b);
});

// ── buildExplainSystemPrompt ───────────────────────────────────────────────

Deno.test('the span never appears in the system prompt', () => {
  // The passage is public-domain prose, but it is still untrusted as model
  // input — a nineteenth-century narrator addressing the reader is
  // indistinguishable from an injected directive once pasted into a system
  // string. It goes as a user-role message and this function has no parameter
  // that could carry it.
  const prompt = buildExplainSystemPrompt('French', 'English', 'B1');
  assert(!prompt.includes(PARAGRAPH));
  assertEquals(buildExplainSystemPrompt.length, 3);
});

Deno.test('the prompt names the level, the language and the language to answer in', () => {
  const prompt = buildExplainSystemPrompt('French', 'English', 'B1');
  assert(prompt.includes('B1'));
  assert(prompt.includes('French'));
  assert(prompt.includes('English'));
});

Deno.test('the prompt tells the model the next message is a quotation, not an instruction', () => {
  const prompt = buildExplainSystemPrompt('French', 'English', 'B1').toLowerCase();
  assert(prompt.includes('not an instruction'));
});
