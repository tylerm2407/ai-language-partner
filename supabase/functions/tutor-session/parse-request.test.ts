import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { parseStartRequest, parseTurnRequest, parseEndRequest, VALID_LEVELS } from './parse-request.ts';

Deno.test('a well-formed start request parses', () => {
  const r = parseStartRequest({
    targetLanguage: 'es', nativeLanguage: 'en', level: 'intermediate',
    correctionMode: 'as_you_go', scenarioKey: 'restaurant', personaId: 'mara',
  });
  assert(r.ok);
  assertEquals(r.value.targetLanguage, 'es');
  assertEquals(r.value.correctionMode, 'as_you_go');
});

Deno.test('an unsupported language or level is refused', () => {
  for (const lang of ['', 'klingon', 'xx', 'sv']) {
    const r = parseStartRequest({ targetLanguage: lang, level: 'intermediate', correctionMode: 'as_you_go' });
    assert(!r.ok, `${lang} should be refused`);
  }
  for (const level of ['', 'expert', 'B1', 'fluent']) {
    const r = parseStartRequest({ targetLanguage: 'es', level, correctionMode: 'as_you_go' });
    assert(!r.ok, `${level} should be refused`);
  }
});

Deno.test('every level the app actually uses is accepted', () => {
  for (const level of VALID_LEVELS) {
    const r = parseStartRequest({ targetLanguage: 'es', level, correctionMode: 'let_me_talk' });
    assert(r.ok, `${level} should be accepted`);
  }
});

Deno.test('an unknown correction mode is refused rather than defaulted', () => {
  // Defaulting would silently put a learner who asked to be left alone into
  // correcting mode, which is the one thing they explicitly opted out of.
  for (const mode of [undefined, null, '', 'gentle', 'live', true]) {
    const r = parseStartRequest({ targetLanguage: 'es', level: 'beginner', correctionMode: mode });
    assert(!r.ok, `${String(mode)} should be refused`);
  }
});

Deno.test('an unrecognised native language degrades to English, it does not block', () => {
  // Only ever a hint for the debrief; refusing would cost the whole session
  // over a field that barely matters.
  const r = parseStartRequest({
    targetLanguage: 'es', nativeLanguage: 'klingon', level: 'beginner', correctionMode: 'as_you_go',
  });
  assert(r.ok);
  assertEquals(r.value.nativeLanguage, 'en');
});

Deno.test('an unknown scenario key is dropped, not rejected', () => {
  // getScenario returns null and the session degrades to free conversation,
  // which beats a 400 the learner cannot act on.
  const r = parseStartRequest({
    targetLanguage: 'es', level: 'beginner', correctionMode: 'as_you_go', scenarioKey: 12345,
  });
  assert(r.ok);
  assertEquals(r.value.scenarioKey, null);
});

Deno.test('a non-finite requestedMinutes is discarded', () => {
  for (const v of [NaN, Infinity, -Infinity, 'twenty', null]) {
    const r = parseStartRequest({
      targetLanguage: 'es', level: 'beginner', correctionMode: 'as_you_go', requestedMinutes: v,
    });
    assert(r.ok);
    assertEquals(r.value.requestedMinutes, undefined);
  }
});

Deno.test('a persona id is passed through unvalidated, on purpose', () => {
  // resolvePersona re-validates against the closed table, because this value
  // ultimately selects a paid voice. Validating in two places would let the two
  // lists drift.
  const r = parseStartRequest({
    targetLanguage: 'es', level: 'beginner', correctionMode: 'as_you_go', personaId: 'not_a_persona',
  });
  assert(r.ok);
  assertEquals(r.value.personaId, 'not_a_persona');
});

Deno.test('turn and end both require a sessionId', () => {
  assert(!parseTurnRequest({}).ok);
  assert(!parseTurnRequest({ sessionId: '' }).ok);
  assert(!parseEndRequest({}).ok);
  assert(!parseEndRequest({ sessionId: '' }).ok);
});

Deno.test('non-numeric turn telemetry is dropped rather than coerced', () => {
  const r = parseTurnRequest({
    sessionId: 's1', elapsedSeconds: 'lots', recognizerConfidence: 'high', tutorText: 42,
  });
  assert(r.ok);
  assertEquals(r.value.elapsedSeconds, undefined);
  assertEquals(r.value.recognizerConfidence, undefined);
  assertEquals(r.value.tutorText, undefined);
});

Deno.test('an unrecognised end reason falls back to learner', () => {
  // The reason is telemetry, not a control signal, so a stale client sending a
  // retired reason must still be able to close its session.
  for (const reason of ['abandoned', 'whatever', undefined, 99]) {
    const r = parseEndRequest({ sessionId: 's1', endReason: reason });
    assert(r.ok);
    assertEquals(r.value.endReason, 'learner');
  }
  // 'abandoned' specifically belongs to the reaper, never to a client.
  const known = parseEndRequest({ sessionId: 's1', endReason: 'budget' });
  assert(known.ok);
  assertEquals(known.value.endReason, 'budget');
});
