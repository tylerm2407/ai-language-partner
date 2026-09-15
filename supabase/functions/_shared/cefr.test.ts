// Deno tests for the shared CEFR ladder and the band resolver.
// Run with: deno test --allow-read --allow-env supabase/functions/_shared/cefr.test.ts

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  CEFR_LADDER,
  cefrToProficiency,
  normalizeCefrLevel,
  proficiencyToCefr,
  resolveCefrLevel,
} from './cefr.ts';

Deno.test('resolveCefrLevel prefers a valid client band over the declared level', () => {
  // The whole point: the declared level must stop being a ceiling.
  assertEquals(resolveCefrLevel('elementary', 'B1'), 'B1');
  assertEquals(resolveCefrLevel('beginner', 'C2'), 'C2');
  // And it can go DOWN too — a measured band below the declared one is the
  // honest one.
  assertEquals(resolveCefrLevel('advanced', 'A2'), 'A2');
});

Deno.test('resolveCefrLevel accepts lowercase and surrounding whitespace', () => {
  assertEquals(resolveCefrLevel('beginner', 'b2'), 'B2');
  assertEquals(resolveCefrLevel('beginner', '  C1\n'), 'C1');
  assertEquals(resolveCefrLevel('beginner', ' a1 '), 'A1');
});

Deno.test('resolveCefrLevel falls back to the declared level for anything that is not a band', () => {
  for (const junk of [undefined, null, '', '   ', 'B3', 'D1', 'B1-B2', 'B1+', 'intermediate', 42, true, {}, ['B1']]) {
    assertEquals(resolveCefrLevel('intermediate', junk), 'B1', `${JSON.stringify(junk)} should fall back`);
  }
  // And the declared-level fallback itself falls back to A1 for junk.
  assertEquals(resolveCefrLevel('expert', undefined), 'A1');
  assertEquals(resolveCefrLevel(null, null), 'A1');
});

Deno.test('normalizeCefrLevel is strict about the shape', () => {
  assertEquals(normalizeCefrLevel('B1'), 'B1');
  assertEquals(normalizeCefrLevel('b1'), 'B1');
  assertEquals(normalizeCefrLevel('B1-B2'), null);
  assertEquals(normalizeCefrLevel('xB1'), null);
  assertEquals(normalizeCefrLevel(''), null);
  assertEquals(normalizeCefrLevel(undefined), null);
});

Deno.test('the ladder covers every band the level checker knows, in order', () => {
  assertEquals([...CEFR_LADDER], ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
});

Deno.test('cefrToProficiency inverts proficiencyToCefr on every declared level', () => {
  for (const level of ['beginner', 'elementary', 'intermediate', 'upper_intermediate', 'advanced'] as const) {
    assertEquals(cefrToProficiency(proficiencyToCefr(level)), level);
  }
});

Deno.test('C2 maps to advanced: the enum has no rung above C1', () => {
  assertEquals(cefrToProficiency('C2'), 'advanced');
  assertEquals(cefrToProficiency('C1'), 'advanced');
});
