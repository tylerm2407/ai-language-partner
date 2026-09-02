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

// ─── Voice gender coverage ───────────────────────────────────────
//
// The learner-facing male/female switch is only honest if every language can
// actually produce both. These parse ELEVENLABS_VOICE_GENDER out of index.ts
// the same way loadVoiceMap does, for the same reason (index.ts calls serve()
// at import time and can't be imported from a test).

async function loadVoiceGenders(): Promise<Record<string, string>> {
  const src = await Deno.readTextFile(INDEX_PATH);
  const marker = 'const ELEVENLABS_VOICE_GENDER: Record<string, VoiceGender> = {';
  const start = src.indexOf(marker);
  assert(start >= 0, 'ELEVENLABS_VOICE_GENDER declaration not found');
  const end = src.indexOf('};', start);
  assert(end > start, 'Could not find end of ELEVENLABS_VOICE_GENDER');

  const genders: Record<string, string> = {};
  const re = /'?([A-Za-z0-9]{15,40})'?\s*:\s*'(male|female)'/g;
  let m: RegExpExecArray | null;
  const body = src.slice(start + marker.length, end);
  while ((m = re.exec(body)) !== null) genders[m[1]] = m[2];
  return genders;
}

Deno.test('every VOICE_MAP voice has a known gender', async () => {
  const map = await loadVoiceMap();
  const genders = await loadVoiceGenders();
  for (const [lang, voices] of Object.entries(map)) {
    for (const id of voices) {
      assert(genders[id], `voice ${id} in ${lang} has no gender entry`);
    }
  }
});

Deno.test('every language offers both a male and a female voice', async () => {
  const map = await loadVoiceMap();
  const genders = await loadVoiceGenders();
  for (const [lang, voices] of Object.entries(map)) {
    const present = new Set(voices.map((id) => genders[id]));
    assert(present.has('male'), `${lang} has no male voice — the gender switch would be a lie`);
    assert(present.has('female'), `${lang} has no female voice — the gender switch would be a lie`);
  }
});

// ── Voice metering ────────────────────────────────────────────────────────
//
// These pin the fix for the bug where `tts` charged a flat 1.0 voice minute
// per synthesis while `transcribe` charged real Whisper seconds into the same
// NUMERIC column. Both halves of one spoken turn billed `daily_usage
// .voice_minutes` in incompatible units, so a `basic` learner's 6 daily
// "voice minutes" bought six spoken replies rather than six minutes of
// conversation, and the tutor then fell silent with no explanation.
//
// Source-parsed for the same reason as VOICE_MAP above: index.ts calls
// serve() at import time.

async function loadIndexSource(): Promise<string> {
  return await Deno.readTextFile(INDEX_PATH);
}

Deno.test('voice minutes are billed from audio duration, never a flat unit', async () => {
  const src = await loadIndexSource();
  const call = src.slice(src.indexOf("rpc('increment_daily_usage'"));
  assert(call.length > 0, 'increment_daily_usage call not found');
  const args = call.slice(0, call.indexOf('}'));

  assert(
    !/p_voice_minutes:\s*1\s*,/.test(args),
    'p_voice_minutes is a flat 1 again — one synthesis is not one minute',
  );
  assert(
    /p_voice_minutes:\s*durationMs\s*\/\s*60_?000/.test(args),
    'p_voice_minutes should be milliseconds of rendered audio over 60,000',
  );
});

Deno.test('duration is measured from the bytes, estimated only as a fallback', async () => {
  const src = await loadIndexSource();
  assert(
    /parseMp3DurationMs\(audioBuffer\)\s*\?\?\s*estimateDurationMs\(/.test(src),
    'measure the rendered MP3 first; the character estimate is the fallback',
  );
  assert(
    src.includes("from '../_shared/mp3-duration.ts'"),
    'the duration helpers live in _shared so tts and news-audio share one copy',
  );
});

Deno.test('the NUMERIC voice_minutes column is parsed, not coerced', async () => {
  const src = await loadIndexSource();
  // PostgREST serialises NUMERIC as a JSON string to keep arbitrary
  // precision. `'10' >= 6` happens to be true; `'10' + 0.2` is '100.2'.
  assert(
    /parseFloat\(data\?\.voice_minutes as string\)/.test(src),
    'voice_minutes arrives as a string and must be parsed before arithmetic',
  );
});

Deno.test('limits come from getEffectiveLimits with the tier passed in', async () => {
  const src = await loadIndexSource();
  // Effective, so a classroom learner gets their school's voice override.
  // Tier passed, because the RPC does not return dailyLessonTtsPlays — without
  // it every paid learner's lesson audio would fall back to the free 5 plays.
  assert(
    /getEffectiveLimits\(\s*authenticatedUserId,\s*supabase,\s*tier\s*\)/.test(src),
    'tts must resolve limits through getEffectiveLimits(userId, supabase, tier)',
  );
  assert(!/\bgetPlanLimits\(/.test(src), 'tts should no longer read personal-tier limits directly');
});

// ── Audio delivery ────────────────────────────────────────────────────────
//
// base64 cannot play until the last byte has transferred and been decoded, so
// the learner waited for the whole reply before hearing the first syllable —
// and base64 inflates the transfer by a third on the way. A signed URL streams,
// and on a cache hit the bytes never enter this function at all.
//
// The flag is opt-in so a build predating it keeps getting exactly what it got
// before; these pin that both halves of that promise hold.

Deno.test('the URL path is opt-in, so older clients are unaffected', async () => {
  const src = await loadIndexSource();
  assert(/preferUrl\?: boolean/.test(src), 'preferUrl should be an optional request field');
  // Every URL return sits behind the flag.
  for (const m of src.matchAll(/return new Response\(JSON\.stringify\(\{ audioUrl/g)) {
    const before = src.slice(0, m.index!);
    assert(
      before.lastIndexOf('if (preferUrl)') > before.lastIndexOf('const base64 ='),
      'an audioUrl response must be guarded by preferUrl',
    );
  }
});

Deno.test('a cache hit signs without downloading the audio', async () => {
  const src = await loadIndexSource();
  const hit = src.slice(src.indexOf('if (preferUrl) {'), src.indexOf('const cached = await readCache'));
  assert(hit.includes('signedUrlFor(cachePath)'), 'the hit path should sign');
  assert(
    !hit.includes('readCache'),
    'the whole point is that a hit no longer pulls the bytes through this function',
  );
});

Deno.test('signing failure falls back to bytes rather than failing the turn', async () => {
  const src = await loadIndexSource();
  // Both the hit and the fresh path must survive a signing error: the learner
  // is waiting on audio, and we are holding audio.
  assert(src.includes('// Signing failed — fall through to the byte path rather than resynthesising.'));
  assert(src.includes('// Signing failed after a successful synthesis. Fall back to the bytes we'));
});

Deno.test('the cache bucket stays private — URLs are signed and short-lived', async () => {
  const src = await loadIndexSource();
  assert(!/getPublicUrl/.test(src), 'a public bucket would let anyone enumerate the cache');
  assert(/createSignedUrl\(path, 300\)/.test(src), 'signed URLs should be short-lived');
});
