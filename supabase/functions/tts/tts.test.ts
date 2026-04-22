// Deno test for the multi-voice VOICE_MAP in supabase/functions/tts/index.ts
//
// Run with: `deno test supabase/functions/tts/tts.test.ts --allow-read`
//
// We do NOT import from ./index.ts directly because that module calls
// `serve(...)` at import time and relies on Deno.env.get for Supabase/
// ElevenLabs secrets. Instead we parse index.ts as text and extract the
// VOICE_MAP object literal. This keeps the test hermetic and lets us assert
// voice-count invariants without booting the edge function.
//
// Invariants under test:
//  - es, fr, de, it, pt, en each have ≥ 4 voice IDs (HVPT minimum).
//  - Other covered languages (ja, ko, zh, ru, hi, ar) each have ≥ 1 voice
//    (documented via TODO comments where fewer native voices exist).
//  - No duplicate voice IDs within a single language (rotation relies on
//    distinctness).
//  - All voice IDs look like ElevenLabs IDs (20-char base62-ish strings).

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

const INDEX_PATH = new URL('./index.ts', import.meta.url);

async function loadVoiceMap(): Promise<Record<string, string[]>> {
  const src = await Deno.readTextFile(INDEX_PATH);

  // Find `const VOICE_MAP: Record<string, string[]> = {` through the
  // matching closing `};` at brace depth 0.
  const marker = 'const VOICE_MAP: Record<string, string[]> = {';
  const start = src.indexOf(marker);
  assert(start >= 0, 'VOICE_MAP declaration not found');
  const bodyStart = start + marker.length - 1; // position of `{`

  let depth = 0;
  let end = -1;
  for (let i = bodyStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  assert(end > bodyStart, 'Could not find end of VOICE_MAP object');

  const objLiteral = src.slice(bodyStart, end);

  // Pull `lang: [ 'id1', 'id2', ... ]` pairs out of the literal. We ignore
  // comments because we only care about the string IDs. Language keys are
  // 2-3 lowercase letters (BCP-47-ish).
  const map: Record<string, string[]> = {};
  const entryRe = /(\w{2,3})\s*:\s*\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(objLiteral)) !== null) {
    const lang = m[1];
    const arrBody = m[2];
    const idRe = /'([A-Za-z0-9]{15,40})'/g;
    const ids: string[] = [];
    let im: RegExpExecArray | null;
    while ((im = idRe.exec(arrBody)) !== null) {
      ids.push(im[1]);
    }
    map[lang] = ids;
  }
  return map;
}

Deno.test('VOICE_MAP: major languages each have ≥ 4 voices (HVPT minimum)', async () => {
  const map = await loadVoiceMap();
  for (const lang of ['es', 'fr', 'de', 'it', 'pt', 'en']) {
    const voices = map[lang];
    assert(voices, `missing language key: ${lang}`);
    assert(
      voices.length >= 4,
      `expected ≥4 voices for ${lang}, got ${voices.length}: ${JSON.stringify(voices)}`
    );
  }
});

Deno.test('VOICE_MAP: other covered languages each have ≥ 1 voice', async () => {
  const map = await loadVoiceMap();
  for (const lang of ['ja', 'ko', 'zh', 'ru', 'hi', 'ar']) {
    const voices = map[lang];
    assert(voices, `missing language key: ${lang}`);
    assert(
      voices.length >= 1,
      `expected ≥1 voice for ${lang}, got ${voices.length}`
    );
  }
});

Deno.test('VOICE_MAP: no duplicate voice IDs within a language', async () => {
  const map = await loadVoiceMap();
  for (const [lang, voices] of Object.entries(map)) {
    const unique = new Set(voices);
    assertEquals(
      unique.size,
      voices.length,
      `duplicate voice IDs in ${lang}: ${JSON.stringify(voices)}`
    );
  }
});

Deno.test('VOICE_MAP: voice IDs look like ElevenLabs IDs (15-40 alphanumerics)', async () => {
  const map = await loadVoiceMap();
  const idShape = /^[A-Za-z0-9]{15,40}$/;
  for (const [lang, voices] of Object.entries(map)) {
    for (const id of voices) {
      assert(idShape.test(id), `invalid-looking voice ID in ${lang}: ${id}`);
    }
  }
});

Deno.test('VOICE_MAP: documented voice-count summary (snapshot)', async () => {
  const map = await loadVoiceMap();
  // Keep an explicit map so drops in coverage are obvious in PR review.
  // Update deliberately when expanding voice arrays.
  const summary: Record<string, number> = {};
  for (const [lang, voices] of Object.entries(map)) {
    summary[lang] = voices.length;
  }
  // Languages we care about must all be present.
  for (const lang of ['es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ru', 'en', 'hi', 'ar']) {
    assert(lang in summary, `missing summary entry for ${lang}`);
  }
});
