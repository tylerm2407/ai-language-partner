import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  TUTOR_PERSONAS,
  DEFAULT_PERSONA_ID,
  resolvePersona,
  speechSpeedForLevel,
} from './personas.ts';

Deno.test('an unknown or missing persona resolves rather than throwing', () => {
  // A stale client asking for a retired persona must still get a tutor. The
  // alternative is a learner who cannot start a session until they update.
  assertEquals(resolvePersona(undefined).id, DEFAULT_PERSONA_ID);
  assertEquals(resolvePersona(null).id, DEFAULT_PERSONA_ID);
  assertEquals(resolvePersona('').id, DEFAULT_PERSONA_ID);
  assertEquals(resolvePersona('dr_evil').id, DEFAULT_PERSONA_ID);
  assertEquals(resolvePersona(42).id, DEFAULT_PERSONA_ID);
  assertEquals(resolvePersona({ id: 'mara' }).id, DEFAULT_PERSONA_ID);
});

Deno.test('a known persona resolves to itself', () => {
  for (const id of Object.keys(TUTOR_PERSONAS)) {
    assertEquals(resolvePersona(id).id, id);
  }
});

Deno.test('the client can never inject a voice string', () => {
  // The voice reaches a paid vendor API. Only ids from the closed table can
  // select one, and every one of them maps to a non-empty voice we chose.
  for (const persona of Object.values(TUTOR_PERSONAS)) {
    assert(persona.voice.length > 0);
    assert(/^[a-z]+$/.test(persona.voice), `suspicious voice id: ${persona.voice}`);
  }
});

Deno.test('the default persona is one that actually exists', () => {
  assert(TUTOR_PERSONAS[DEFAULT_PERSONA_ID], 'default persona must be in the table');
});

Deno.test('personas are distinguishable by voice', () => {
  // Two personas sharing a voice would make them the same tutor wearing
  // different names, which defeats the point of offering a choice.
  const voices = Object.values(TUTOR_PERSONAS).map((p) => p.voice);
  assertEquals(new Set(voices).size, voices.length);
});

Deno.test('only the levels that need slow speech get it', () => {
  assertEquals(speechSpeedForLevel('beginner'), 0.9);
  assertEquals(speechSpeedForLevel('elementary'), 0.9);
  // Slowing speech for a learner who does not need it trains them on input
  // they will never hear outside the app.
  assertEquals(speechSpeedForLevel('intermediate'), 1.0);
  assertEquals(speechSpeedForLevel('advanced'), 1.0);
  assertEquals(speechSpeedForLevel('nonsense'), 1.0);
});
