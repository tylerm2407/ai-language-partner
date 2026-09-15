// The `mission_phrase_cache` key. Modelled on translate/cache-key.ts and for
// the same reason: a hash that differs by one byte from the one that wrote
// the row never hits, and nothing reports that — the bill just never drops.
// So there is exactly one implementation, and it is tested.
//
// The version is part of the key. Bumping it orphans every existing row
// (they stay readable by nothing, and migration 126's header describes the
// manual sweep); it is how a prompt change reaches learners who already saw
// the old phrases.
//
// No imports and no Deno globals on purpose — `crypto.subtle` is available in
// Deno, in Node 18+, and in browsers, so a warming script could import this.

export const MISSION_PHRASES_VERSION = 1;

/** sha256 hex of [scenarioKey, stage, targetLanguage, nativeLanguage, version]. */
export async function missionPhrasesKey(
  scenarioKey: string,
  stage: number,
  targetLanguage: string,
  nativeLanguage: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(
      JSON.stringify([scenarioKey, stage, targetLanguage, nativeLanguage, MISSION_PHRASES_VERSION]),
    ),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
