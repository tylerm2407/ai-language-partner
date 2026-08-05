// Deno test for toLanguageCode in supabase/functions/_shared/language.ts
//
// Run with: `deno test supabase/functions/_shared/language.test.ts`

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { toLanguageCode } from './language.ts';

Deno.test('maps Whisper language names to app codes', () => {
  assertEquals(toLanguageCode('spanish'), 'es');
  assertEquals(toLanguageCode('english'), 'en');
  assertEquals(toLanguageCode('japanese'), 'ja');
});

Deno.test('is tolerant of casing and surrounding whitespace', () => {
  assertEquals(toLanguageCode('Spanish'), 'es');
  assertEquals(toLanguageCode('  FRENCH  '), 'fr');
});

Deno.test('passes through codes Whisper already normalised', () => {
  assertEquals(toLanguageCode('es'), 'es');
  assertEquals(toLanguageCode('ZH'), 'zh');
});

Deno.test('returns null for languages the app does not teach', () => {
  // Whisper detects ~100 languages; only the taught ones may flow downstream,
  // so the caller falls back to its hint instead of forwarding e.g. 'sw'.
  assertEquals(toLanguageCode('swahili'), null);
  assertEquals(toLanguageCode('sw'), null);
});

Deno.test('returns null for missing or non-string detections', () => {
  assertEquals(toLanguageCode(undefined), null);
  assertEquals(toLanguageCode(null), null);
  assertEquals(toLanguageCode(42), null);
  assertEquals(toLanguageCode(''), null);
});
