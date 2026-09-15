// Deno tests for the mission phrase cache key.
//
// Run with: `deno test supabase/functions/_shared/mission-phrases-key.test.ts`
//
// The serialisation is pinned byte for byte: a reordered tuple or a changed
// separator would write rows nothing can read, with no error to say so.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { MISSION_PHRASES_VERSION, missionPhrasesKey } from './mission-phrases-key.ts';

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.test('the key is a 64-char lowercase hex digest and is deterministic', async () => {
  const a = await missionPhrasesKey('restaurant', 1, 'es', 'en');
  const b = await missionPhrasesKey('restaurant', 1, 'es', 'en');
  assertEquals(a, b);
  assert(/^[0-9a-f]{64}$/.test(a));
});

Deno.test('the key is sha256 of the JSON tuple, version last', async () => {
  const expected = await sha256Hex(JSON.stringify(['restaurant', 1, 'es', 'en', MISSION_PHRASES_VERSION]));
  assertEquals(await missionPhrasesKey('restaurant', 1, 'es', 'en'), expected);
  assertEquals(MISSION_PHRASES_VERSION, 1, 'bumping the version orphans every cached row — see the header');
});

Deno.test('every argument changes the key', async () => {
  const base = await missionPhrasesKey('restaurant', 1, 'es', 'en');
  assert(base !== await missionPhrasesKey('shopping', 1, 'es', 'en'));
  assert(base !== await missionPhrasesKey('restaurant', 2, 'es', 'en'));
  assert(base !== await missionPhrasesKey('restaurant', 1, 'fr', 'en'));
  assert(base !== await missionPhrasesKey('restaurant', 1, 'es', 'ja'));
});

Deno.test('the stage is hashed as a number, so "1" and 1 are different keys', async () => {
  // A caller that forgot to coerce would silently populate a parallel cache.
  const numeric = await missionPhrasesKey('restaurant', 1, 'es', 'en');
  const stringy = await missionPhrasesKey('restaurant', '1' as unknown as number, 'es', 'en');
  assert(numeric !== stringy);
});
