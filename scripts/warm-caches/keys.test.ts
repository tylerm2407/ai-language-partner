/**
 * The cache keys are the only part of this script that can fail silently and
 * totally: a key that differs from the reader's by one byte writes rows and
 * objects nothing will ever look for. Nothing throws. The bill just never
 * drops. So these tests are the load-bearing ones.
 *
 * They work two ways, and both are needed:
 *
 *   1. Against the REAL implementation. keys.ts imports the enforcing
 *      functions rather than copying them, so calling them here is calling the
 *      same code the edge function calls. Golden vectors recomputed with
 *      node:crypto pin the hash SHAPE — which fields, in which order — so a
 *      change to the tuple fails here even though both sides would still agree
 *      with each other.
 *   2. Against the edge function's SOURCE TEXT, for the pieces that live
 *      inside a module Node cannot import (it calls `serve()` and reads
 *      `Deno.env` at import time). Reading the source is how tts.test.ts
 *      already tests those same files.
 */

import { createHash, webcrypto } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  asCitationForm,
  cachePathFor,
  explanationCacheKey,
  hintCacheKey,
  lessonAudioPath,
  lessonFishVoiceId,
  sha256Hex,
  translationCacheKey,
  ttsContentKey,
} from './keys';

const FUNCTIONS = resolve(__dirname, '..', '..', 'supabase', 'functions');
const source = (relative: string): string => readFileSync(resolve(FUNCTIONS, relative), 'utf-8');

beforeAll(() => {
  // The edge functions run on Deno / the app runs on Hermes, both of which
  // expose WebCrypto globally. Jest's node environment may not — shimming the
  // environment is not the same as reimplementing the hash.
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

const sha256 = (input: string): string => createHash('sha256').update(input, 'utf8').digest('hex');

describe('translation_cache key', () => {
  it('is sha256 of [sourceLang, targetLang, text], in that order', async () => {
    const key = await translationCacheKey('perro', 'es', 'en');
    expect(key).toBe(sha256(JSON.stringify(['es', 'en', 'perro'])));
  });

  it('separates the two directions of the same pair', async () => {
    expect(await translationCacheKey('perro', 'es', 'en')).not.toBe(
      await translationCacheKey('perro', 'en', 'es'),
    );
  });

  it('survives non-ASCII text byte-for-byte', async () => {
    for (const text of ['犬', '개', 'こんにちは', 'Grüße', 'привет']) {
      expect(await translationCacheKey(text, 'ja', 'en')).toBe(
        sha256(JSON.stringify(['ja', 'en', text])),
      );
    }
  });

  it('is the same function the translate edge function calls', () => {
    const index = source('translate/index.ts');
    expect(index).toContain("import { cacheKey } from './cache-key.ts';");
    expect(index).toContain('await cacheKey(input, sourceLanguage, targetLanguage)');
    // and the function itself must not have been re-inlined alongside it
    expect(index).not.toMatch(/function cacheKey\s*\(/);
  });
});

describe('explanation_cache key', () => {
  it('is sha256 of [language, nativeLanguage, cefrLevel, span]', async () => {
    const span = 'La comida es una parte importante de la cultura.';
    expect(await explanationCacheKey('es', 'en', 'B1', span)).toBe(
      sha256(JSON.stringify(['es', 'en', 'B1', span])),
    );
  });

  it('is the function explain-passage imports', () => {
    expect(source('explain-passage/index.ts')).toContain(
      "import { buildExplainSystemPrompt, checkSpan, explanationCacheKey } from './explain-core.ts';",
    );
    expect(source('explain-passage/index.ts')).toContain(
      'await explanationCacheKey(language, nativeLanguage, cefrLevel, span.span)',
    );
  });
});

describe('hint_cache key', () => {
  it('is the (card_id, exercise_type) pair the edge function reads and writes', () => {
    const index = source('get-hint/index.ts');
    expect(index).toContain(".eq('card_id', cardId)");
    expect(index).toContain(".eq('exercise_type', exerciseType)");
    expect(index).toContain('.upsert({ card_id: cardId, exercise_type: exerciseType, hint })');
  });

  it('round-trips through the composite key used for deduping', () => {
    const id = '11111111-2222-3333-4444-555555555555';
    expect(hintCacheKey(id, 'listening_type')).toBe(`${id}::listening_type`);
  });
});

describe('tts-cache path', () => {
  it('hashes the same composition the tts edge function hashes', async () => {
    const key = ttsContentKey({ provider: 'fish', voiceId: 'v1', language: 'es', text: 'perro.' });
    expect(key).toBe('fish|v1|es|perro.');
    expect(await sha256Hex(key)).toBe(sha256(key));
  });

  it('keeps ElevenLabs on the un-namespaced legacy composition', () => {
    expect(ttsContentKey({ provider: 'elevenlabs', voiceId: 'v1', language: 'es', text: 'x' })).toBe(
      'v1|es|x',
    );
  });

  it('is the composition and hash the edge function now imports', () => {
    const index = source('tts/index.ts');
    expect(index).toContain(
      'const key = ttsContentKey({ provider: p, voiceId: v, language, text: cleanText });',
    );
    expect(index).toContain('return cachePathFor({ hash: await sha256Hex(key), purpose, rate });');
    // neither helper may be re-declared locally
    expect(index).not.toMatch(/function sha256Hex\s*\(/);
  });

  it('applies citation form BEFORE hashing, as the edge function does', async () => {
    const { path, sentText } = await lessonAudioPath({ text: 'perro', language: 'es', voiceId: 'v1' });
    expect(sentText).toBe('perro.');
    expect(asCitationForm('perro')).toBe('perro.');
    expect(path).toBe(
      cachePathFor({ hash: await sha256Hex('fish|v1|es|perro.'), purpose: 'lesson' }),
    );
    expect(path).toMatch(/^lesson\/v\d+\/[0-9a-f]{64}\.mp3$/);
  });

  it('strips the bold markers the edge function strips', async () => {
    const bold = await lessonAudioPath({ text: '**perro**', language: 'es', voiceId: 'v1' });
    const plain = await lessonAudioPath({ text: 'perro', language: 'es', voiceId: 'v1' });
    expect(bold.path).toBe(plain.path);
    expect(source('tts/index.ts')).toContain("text.replace(/\\*\\*/g, '').trim()");
  });

  it('gives a slow replay its own namespace, never the canonical one', async () => {
    const normal = await lessonAudioPath({ text: 'perro', language: 'es', voiceId: 'v1' });
    const slow = await lessonAudioPath({ text: 'perro', language: 'es', voiceId: 'v1', rate: 0.75 });
    expect(slow.path).not.toBe(normal.path);
    expect(slow.path).toContain('/r075/');
  });
});

describe('lesson voice selection', () => {
  const map = { es: { male: ['m1', 'm2'], female: ['f1'] }, ru: { male: ['m9'] }, ar: {} };

  it('picks female[0] — the edge function default when no gender is asked for', () => {
    expect(lessonFishVoiceId('es', map)).toBe('f1');
  });

  it('falls back to male when the language has no female voice', () => {
    expect(lessonFishVoiceId('ru', map)).toBe('m9');
  });

  it('returns null rather than guessing for a language fish cannot serve', () => {
    expect(lessonFishVoiceId('ar', map)).toBeNull();
    expect(lessonFishVoiceId('sv', map)).toBeNull();
  });

  it('mirrors the edge function selection and the lesson caller it assumes', () => {
    expect(source('tts/index.ts')).toContain('fishForLanguage.female ?? fishForLanguage.male');
    // lib/lesson-audio.ts sends voiceIndex 0 and no gender, which is what makes
    // "one object per word for every learner" true and this test meaningful.
    const lessonAudio = readFileSync(
      resolve(__dirname, '..', '..', 'lib', 'lesson-audio.ts'),
      'utf-8',
    );
    expect(lessonAudio).toContain('voiceIndex: 0');
    expect(lessonAudio).not.toContain('voiceGender');
  });
});
