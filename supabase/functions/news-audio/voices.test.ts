// Deno tests for ./voices.ts.
//
// Run with: `deno test supabase/functions/news-audio/voices.test.ts`
//
// Two properties matter here.
//
// 1. RESOLUTION ORDER: editorial fish → chat fish → ElevenLabs. Step 2 is
//    the one carrying production, because ElevenLabs is currently broken
//    (the prod key is an API key ID, not an `sk_` key). If step 2 ever
//    silently stops resolving, every language falls to a provider that
//    rejects the request and the whole feature goes dark.
//
// 2. DEGRADATION: a malformed secret must return {} and never throw. The
//    news podcast and the chat tutor now read the SAME FISH_VOICE_MAP, so a
//    parse that threw would take down two features instead of none.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  DEFAULT_ELEVEN_VOICE,
  ELEVEN_NEWS_VOICES,
  narratorCoverage,
  NARRATABLE_LANGUAGES,
  parseChatVoiceMap,
  parseNewsVoiceMap,
  pickChatNarrator,
  resolveNarrator,
} from './voices.ts';

const CHAT_RAW = JSON.stringify({
  es: { male: ['es-m1', 'es-m2'], female: ['es-f1', 'es-f2'] },
  fr: { male: ['fr-m1'] }, // male only
  de: { female: ['de-f1'] }, // female only
});

// ── Resolution order ────────────────────────────────────────────────

Deno.test('resolveNarrator: 1st — the editorial map wins over everything', () => {
  const n = resolveNarrator({
    language: 'es',
    newsMap: { es: 'editorial-es' },
    chatMap: parseChatVoiceMap(CHAT_RAW),
    fishEnabled: true,
  });
  assertEquals(n, { provider: 'fish', voiceId: 'editorial-es' });
});

Deno.test('resolveNarrator: 2nd — falls to the chat map when no editorial voice', () => {
  const n = resolveNarrator({
    language: 'es',
    newsMap: {},
    chatMap: parseChatVoiceMap(CHAT_RAW),
    fishEnabled: true,
  });
  assertEquals(n, { provider: 'fish', voiceId: 'es-f1' });
});

Deno.test('resolveNarrator: 3rd — ElevenLabs when fish has nothing for the language', () => {
  const n = resolveNarrator({
    language: 'ja',
    newsMap: {},
    chatMap: parseChatVoiceMap(CHAT_RAW),
    fishEnabled: true,
  });
  assertEquals(n, { provider: 'elevenlabs', voiceId: ELEVEN_NEWS_VOICES.ja });
});

Deno.test('resolveNarrator: the editorial map for ONE language does not affect others', () => {
  const opts = {
    newsMap: { fr: 'editorial-fr' },
    chatMap: parseChatVoiceMap(CHAT_RAW),
    fishEnabled: true,
  };
  assertEquals(resolveNarrator({ ...opts, language: 'fr' }).voiceId, 'editorial-fr');
  assertEquals(resolveNarrator({ ...opts, language: 'es' }).voiceId, 'es-f1');
});

Deno.test('resolveNarrator: no FISH_KEY disables both fish steps entirely', () => {
  const n = resolveNarrator({
    language: 'es',
    newsMap: { es: 'editorial-es' },
    chatMap: parseChatVoiceMap(CHAT_RAW),
    fishEnabled: false,
  });
  assertEquals(n.provider, 'elevenlabs');
});

Deno.test('resolveNarrator: an unlisted language still gets a voice, never nothing', () => {
  const n = resolveNarrator({
    language: 'xx',
    newsMap: {},
    chatMap: {},
    fishEnabled: true,
  });
  assertEquals(n, { provider: 'elevenlabs', voiceId: DEFAULT_ELEVEN_VOICE });
});

// ── Determinism ─────────────────────────────────────────────────────

Deno.test('pickChatNarrator: female[0] first, then male[0]', () => {
  const chat = parseChatVoiceMap(CHAT_RAW);
  assertEquals(pickChatNarrator(chat.es), 'es-f1'); // both present → female
  assertEquals(pickChatNarrator(chat.fr), 'fr-m1'); // male only
  assertEquals(pickChatNarrator(chat.de), 'de-f1'); // female only
  assertEquals(pickChatNarrator(undefined), undefined);
});

Deno.test('resolveNarrator: same input always yields the same voice', () => {
  // A news reader that changed voice day to day would read as a different
  // product every morning. This is the assertion that forbids it.
  const opts = { newsMap: {}, chatMap: parseChatVoiceMap(CHAT_RAW), fishEnabled: true };
  const first = resolveNarrator({ ...opts, language: 'es' });
  for (let i = 0; i < 25; i++) {
    assertEquals(resolveNarrator({ ...opts, language: 'es' }), first);
  }
});

// ── Degradation ─────────────────────────────────────────────────────

Deno.test('parseChatVoiceMap: malformed input degrades to {} and never throws', () => {
  for (
    const bad of [
      undefined,
      null,
      '',
      'not json at all',
      '{"es":', // truncated
      '[]', // array root
      '"a string"',
      '42',
      'null',
    ]
  ) {
    const result = parseChatVoiceMap(bad);
    assertEquals(result, {}, `input ${JSON.stringify(bad)} should degrade to {}`);
  }
});

Deno.test('parseChatVoiceMap: skips bad language entries, keeps the good ones', () => {
  const map = parseChatVoiceMap(JSON.stringify({
    es: { female: ['es-f1'] }, // good
    fr: 'not-an-object', // bad shape
    de: { female: 'not-an-array' }, // bad gender
    it: { female: [], male: [] }, // empty → no usable voice
    pt: { female: [123, 'pt-f1', ''] }, // mixed types, one usable
  }));
  assertEquals(Object.keys(map).sort(), ['es', 'pt']);
  assertEquals(map.pt.female, ['pt-f1']);
});

Deno.test('parseNewsVoiceMap: malformed input degrades to {} and never throws', () => {
  for (const bad of [undefined, null, '', 'nonsense', '[]', '{"es":', '7']) {
    assertEquals(parseNewsVoiceMap(bad), {}, `input ${JSON.stringify(bad)} should degrade`);
  }
});

Deno.test('parseNewsVoiceMap: skips non-string ids, keeps valid ones', () => {
  const map = parseNewsVoiceMap(JSON.stringify({ es: 'ok', fr: 123, de: '', it: null }));
  assertEquals(map, { es: 'ok' });
});

Deno.test('a malformed chat secret degrades to ElevenLabs, it does not throw', () => {
  // The whole point of the defensive parse: a bad secret costs the fish
  // voices, not the feature.
  const n = resolveNarrator({
    language: 'es',
    newsMap: parseNewsVoiceMap('garbage'),
    chatMap: parseChatVoiceMap('also garbage'),
    fishEnabled: true,
  });
  assertEquals(n.provider, 'elevenlabs');
});

// ── Coverage reporting ──────────────────────────────────────────────

Deno.test('narratorCoverage: reports a provider for every publishable language', () => {
  const coverage = narratorCoverage({
    newsMap: {},
    chatMap: parseChatVoiceMap(CHAT_RAW),
    fishEnabled: true,
  });
  assertEquals(Object.keys(coverage).sort(), [...NARRATABLE_LANGUAGES].sort());
  assertEquals(coverage.es, 'fish');
  assertEquals(coverage.fr, 'fish');
  assertEquals(coverage.de, 'fish');
  assertEquals(coverage.ja, 'elevenlabs'); // no fish voice → would fail in prod
});

Deno.test('narratorCoverage: leaks providers only, never voice ids', () => {
  // This ends up in an HTTP response and a log line. The reference ids are
  // the secret.
  const coverage = narratorCoverage({
    newsMap: { es: 'SECRET-EDITORIAL-ID' },
    chatMap: parseChatVoiceMap(CHAT_RAW),
    fishEnabled: true,
  });
  const serialized = JSON.stringify(coverage);
  assert(!serialized.includes('SECRET-EDITORIAL-ID'));
  assert(!serialized.includes('es-f1'));
  for (const value of Object.values(coverage)) {
    assert(value === 'fish' || value === 'elevenlabs');
  }
});

Deno.test('narratorCoverage: everything is elevenlabs when fish is unconfigured', () => {
  const coverage = narratorCoverage({ newsMap: {}, chatMap: {}, fishEnabled: false });
  for (const language of NARRATABLE_LANGUAGES) {
    assertEquals(coverage[language], 'elevenlabs');
  }
});
