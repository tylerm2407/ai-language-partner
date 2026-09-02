// Deno tests for ./turn-accuracy.ts.
//
// Run with: `deno test supabase/functions/_shared/turn-accuracy.test.ts`
//
// The contract: this module feeds a *measured proficiency level* the learner
// sees and acts on. So the load-bearing assertions are the refusals — a turn
// that is too short, or spoken and not clearly heard, must produce no
// evidence rather than a confident wrong number. Silence is recoverable; a
// bogus CEFR level is not.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  combinedScore,
  countWords,
  MIN_CONFIDENCE_FOR_EVIDENCE,
  MIN_WORDS_FOR_EVIDENCE,
  scoreTurn,
} from './turn-accuracy.ts';

const CLEAN = 'Quiero reservar una mesa para dos personas esta noche por favor';

Deno.test('a clean turn scores full accuracy', () => {
  const s = scoreTurn({ modality: 'writing', text: CLEAN, correction: null });
  assert(s !== null);
  assertEquals(s.accuracy, 1);
  assertEquals(s.intelligibility, null);
});

Deno.test('severity discounts the turn, and longer turns absorb more', () => {
  const at = (severity: string, text: string) =>
    scoreTurn({
      modality: 'writing',
      text,
      correction: { errorType: 'grammar', severity },
    })!.accuracy;

  // Same error, more language around it — the learner who said more while
  // slipping once is more accurate, not less.
  assert(at('moderate', CLEAN) > at('moderate', 'quiero una mesa dos'));
  // Severity is ordered.
  assert(at('minor', CLEAN) > at('moderate', CLEAN));
  assert(at('moderate', CLEAN) > at('critical', CLEAN));
});

Deno.test('the scale is calibrated against the 0.7 band pass mark', () => {
  // One moderate slip in a twenty-word turn should read as accurate.
  const twentyWords = Array(20).fill('palabra').join(' ');
  const forgiven = scoreTurn({
    modality: 'writing',
    text: twentyWords,
    correction: { errorType: 'tense', severity: 'moderate' },
  })!.accuracy;
  assert(forgiven > 0.7, `expected > 0.7, got ${forgiven}`);

  // A meaning-breaking error in a short turn should not.
  const tenWords = Array(10).fill('palabra').join(' ');
  const penalised = scoreTurn({
    modality: 'writing',
    text: tenWords,
    correction: { errorType: 'grammar', severity: 'critical' },
  })!.accuracy;
  assert(penalised < 0.7, `expected < 0.7, got ${penalised}`);
});

Deno.test('vocabulary errors count — a wrong word is a production error', () => {
  // "Words that don't make sense in the sentence" are scored, not waved
  // through because the grammar around them is sound.
  const s = scoreTurn({
    modality: 'writing',
    text: CLEAN,
    correction: { errorType: 'vocabulary', severity: 'moderate' },
  })!;
  assert(s.accuracy < 1);
});

Deno.test('spelling counts when typed and is ignored when spoken', () => {
  const typed = scoreTurn({
    modality: 'writing',
    text: CLEAN,
    correction: { errorType: 'spelling', severity: 'moderate' },
  })!;
  const spoken = scoreTurn({
    modality: 'speaking',
    text: CLEAN,
    correction: { errorType: 'spelling', severity: 'moderate' },
    recognizerConfidence: 0.9,
  })!;
  assert(typed.accuracy < 1, 'a typed misspelling is the learner\'s');
  assertEquals(spoken.accuracy, 1, 'a spoken "misspelling" is the recogniser\'s homophone');
});

Deno.test('an uncategorised error does not lower a measured level', () => {
  const s = scoreTurn({
    modality: 'writing',
    text: CLEAN,
    correction: { errorType: 'other', severity: 'critical' },
  })!;
  assertEquals(s.accuracy, 1);
});

Deno.test('a missing severity is treated as moderate, not as no error', () => {
  const s = scoreTurn({
    modality: 'writing',
    text: CLEAN,
    correction: { errorType: 'grammar', severity: null },
  })!;
  assert(s.accuracy < 1);
});

Deno.test('a turn too short to be a language sample yields no evidence', () => {
  for (const text of ['', '   ', 'Sí', 'Sí claro', 'no lo sé']) {
    assertEquals(scoreTurn({ modality: 'writing', text, correction: null }), null, text);
  }
  const justEnough = Array(MIN_WORDS_FOR_EVIDENCE).fill('palabra').join(' ');
  assert(scoreTurn({ modality: 'writing', text: justEnough, correction: null }) !== null);
});

Deno.test('a spoken turn we could not hear yields no evidence', () => {
  const below = scoreTurn({
    modality: 'speaking',
    text: CLEAN,
    correction: null,
    recognizerConfidence: MIN_CONFIDENCE_FOR_EVIDENCE - 0.01,
  });
  assertEquals(below, null);

  const at = scoreTurn({
    modality: 'speaking',
    text: CLEAN,
    correction: null,
    recognizerConfidence: MIN_CONFIDENCE_FOR_EVIDENCE,
  });
  assert(at !== null, 'the floor itself is usable');
});

Deno.test('no reported confidence is not the same as low confidence', () => {
  // An older `transcribe` deployment reports nothing. That is missing
  // information about the recogniser, not evidence of a bad utterance, so the
  // turn still counts — on accuracy alone.
  for (const conf of [null, undefined, NaN]) {
    const s = scoreTurn({
      modality: 'speaking',
      text: CLEAN,
      correction: null,
      recognizerConfidence: conf as number | null,
    });
    assert(s !== null, `confidence ${conf} should not discard the turn`);
    assertEquals(s.intelligibility, null);
    assertEquals(combinedScore(s), s.accuracy);
  }
});

Deno.test('speaking weighs being understood alongside being right', () => {
  const s = scoreTurn({
    modality: 'speaking',
    text: CLEAN,
    correction: null,
    recognizerConfidence: 0.6,
  })!;
  assertEquals(s.accuracy, 1);
  assertEquals(s.intelligibility, 0.6);
  assertEquals(combinedScore(s), 0.8);
});

Deno.test('writing is never scored on intelligibility, even if a value arrives', () => {
  const s = scoreTurn({
    modality: 'writing',
    text: CLEAN,
    correction: null,
    recognizerConfidence: 0.2,
  })!;
  assertEquals(s.intelligibility, null);
  assertEquals(combinedScore(s), 1);
});

Deno.test('confidence outside 0-1 is clamped rather than trusted', () => {
  const high = scoreTurn({
    modality: 'speaking', text: CLEAN, correction: null, recognizerConfidence: 9,
  })!;
  assertEquals(high.intelligibility, 1);
});

Deno.test('countWords ignores surrounding and repeated whitespace', () => {
  assertEquals(countWords('  hola   que    tal  '), 3);
  assertEquals(countWords(''), 0);
  assertEquals(countWords('   '), 0);
});
