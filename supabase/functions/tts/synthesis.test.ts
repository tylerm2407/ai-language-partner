// Deno tests for the pure synthesis parameters in ./synthesis.ts.
//
// Run with: `deno test supabase/functions/tts/synthesis.test.ts`
//
// The load-bearing assertion in this file is that VOICE audio keeps its exact
// legacy flat cache path. Every chat line already rendered lives at that path;
// if it ever moves, the whole warm bucket is silently abandoned and re-billed.

import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  asCitationForm,
  cachePathFor,
  clampRate,
  DEFAULT_RATE,
  ELEVEN_PROFILES,
  LESSON_PROFILE_VERSION,
  MAX_RATE,
  MIN_RATE,
  SLOW_RATE,
} from './synthesis.ts';

const HASH = 'a'.repeat(64);

Deno.test('cachePathFor: voice audio keeps the exact flat legacy path', () => {
  // If this ever fails, the existing tts-cache bucket has been orphaned.
  assertEquals(cachePathFor({ hash: HASH, purpose: 'voice' }), `${HASH}.mp3`);
  // A rate must not leak into the voice path either — chat ignores rate.
  assertEquals(cachePathFor({ hash: HASH, purpose: 'voice', rate: 0.75 }), `${HASH}.mp3`);
});

Deno.test('cachePathFor: lesson audio moves under a versioned prefix', () => {
  assertEquals(
    cachePathFor({ hash: HASH, purpose: 'lesson' }),
    `lesson/v${LESSON_PROFILE_VERSION}/${HASH}.mp3`,
  );
});

Deno.test('cachePathFor: the default rate adds no rate segment', () => {
  assertEquals(
    cachePathFor({ hash: HASH, purpose: 'lesson', rate: DEFAULT_RATE }),
    cachePathFor({ hash: HASH, purpose: 'lesson' }),
  );
});

Deno.test('cachePathFor: a slow replay gets its own namespace', () => {
  const slow = cachePathFor({ hash: HASH, purpose: 'lesson', rate: SLOW_RATE });
  assertEquals(slow, `lesson/v${LESSON_PROFILE_VERSION}/r075/${HASH}.mp3`);
  assert(slow !== cachePathFor({ hash: HASH, purpose: 'lesson' }));
});

Deno.test('clampRate: clamps into the supported band', () => {
  assertEquals(clampRate(0.5), MIN_RATE);
  assertEquals(clampRate(1.5), MAX_RATE);
  assertEquals(clampRate(0.75), 0.75);
});

Deno.test('clampRate: unusable input becomes the default rather than an error', () => {
  assertEquals(clampRate(undefined), DEFAULT_RATE);
  assertEquals(clampRate(null), DEFAULT_RATE);
  assertEquals(clampRate('0.8'), DEFAULT_RATE);
  assertEquals(clampRate(NaN), DEFAULT_RATE);
  assertEquals(clampRate(Infinity), DEFAULT_RATE);
});

Deno.test('asCitationForm: gives a bare word a sentence to end', () => {
  assertEquals(asCitationForm('agua'), 'agua.');
  assertEquals(asCitationForm('  agua  '), 'agua.');
});

Deno.test('asCitationForm: is idempotent and respects existing punctuation', () => {
  assertEquals(asCitationForm('agua.'), 'agua.');
  assertEquals(asCitationForm(asCitationForm('agua')), 'agua.');
  assertEquals(asCitationForm('¿Cómo estás?'), '¿Cómo estás?');
  assertEquals(asCitationForm('¡Vamos!'), '¡Vamos!');
});

Deno.test('asCitationForm: respects CJK terminal punctuation', () => {
  assertEquals(asCitationForm('水。'), '水。');
  assertEquals(asCitationForm('你好'), '你好.');
});

Deno.test('asCitationForm: leaves an empty string alone', () => {
  assertEquals(asCitationForm(''), '');
  assertEquals(asCitationForm('   '), '');
});

Deno.test('ELEVEN_PROFILES: the voice profile is unchanged from what the cache was built with', () => {
  // These four values are what every cached chat line was rendered with.
  // Changing them without moving the voice cache path re-bills the bucket.
  assertEquals(ELEVEN_PROFILES.voice.model_id, 'eleven_flash_v2_5');
  assertEquals(ELEVEN_PROFILES.voice.stability, 0.5);
  assertEquals(ELEVEN_PROFILES.voice.similarity_boost, 0.75);
  assertEquals(ELEVEN_PROFILES.voice.style, 0.3);
  assertEquals(ELEVEN_PROFILES.voice.speed, undefined);
});

Deno.test('ELEVEN_PROFILES: the lesson profile trades latency for clarity', () => {
  const lesson = ELEVEN_PROFILES.lesson;
  assert(lesson.model_id !== ELEVEN_PROFILES.voice.model_id, 'lesson must not use the latency model');
  assert(lesson.stability > ELEVEN_PROFILES.voice.stability, 'a vocabulary item wants citation form');
  assertEquals(lesson.style, 0, 'no interpretive flourish on a lone word');
});
