// Deno tests for ./confidence.ts.
//
// Run with: `deno test supabase/functions/transcribe/confidence.test.ts`
//
// The contract being defended: null means "the provider told us nothing",
// never "we are not confident". Downstream, `sttConfidence` reads a null pair
// as NEUTRAL and grades the turn anyway; it reads a low number as a reason to
// refuse to grade. Confusing the two would either fail every turn shut or let
// a misheard answer into the SM-2 schedule, so every degenerate payload here
// must come back null rather than 0.

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { summarizeSegments } from './confidence.ts';

/** A well-formed Whisper segment. */
function seg(
  start: number,
  end: number,
  avg_logprob: number,
  no_speech_prob: number,
): Record<string, number> {
  return { start, end, avg_logprob, no_speech_prob };
}

Deno.test('a single segment reports its own values unchanged', () => {
  const out = summarizeSegments([seg(0, 2, -0.35, 0.02)]);
  assertEquals(out.avgLogprob, -0.35);
  assertEquals(out.noSpeechProb, 0.02);
});

Deno.test('segments are weighted by duration, not counted equally', () => {
  // Nine seconds of confident speech, then a clipped half-second of noise.
  // A plain mean would report roughly -0.55 and drag a good turn under the
  // gate; the weighted mean stays close to the speech that dominated it.
  const out = summarizeSegments([
    seg(0, 9, -0.1, 0.01),
    seg(9, 9.5, -1.0, 0.9),
  ]);
  assert(out.avgLogprob !== null);
  assert(
    out.avgLogprob > -0.2,
    `expected the long confident segment to dominate, got ${out.avgLogprob}`,
  );
  assert(out.noSpeechProb !== null && out.noSpeechProb < 0.1);
});

Deno.test('each field averages over only the segments that reported it', () => {
  // A payload carrying logprob but no no_speech_prob still yields the half it
  // has, rather than discarding both.
  const out = summarizeSegments([
    { start: 0, end: 1, avg_logprob: -0.2 },
    { start: 1, end: 2, avg_logprob: -0.4, no_speech_prob: 0.5 },
  ]);
  assertEquals(out.avgLogprob, -0.30000000000000004); // (-0.2 + -0.4) / 2
  assertEquals(out.noSpeechProb, 0.5);
});

Deno.test('an unmeasurable span still carries its segment\'s opinion', () => {
  // Reversed, zero-length and missing spans must not weigh zero — that would
  // silently drop a real segment out of the average entirely.
  const reversed = summarizeSegments([seg(5, 1, -0.5, 0.3)]);
  assertEquals(reversed.avgLogprob, -0.5);

  const missing = summarizeSegments([{ avg_logprob: -0.5, no_speech_prob: 0.3 }]);
  assertEquals(missing.avgLogprob, -0.5);
  assertEquals(missing.noSpeechProb, 0.3);
});

Deno.test('nothing to summarise reports null, never zero', () => {
  for (const input of [[], undefined, null, 'segments', 42, {}]) {
    const out = summarizeSegments(input);
    assertEquals(out.avgLogprob, null, `input ${JSON.stringify(input)}`);
    assertEquals(out.noSpeechProb, null, `input ${JSON.stringify(input)}`);
  }
});

Deno.test('unusable entries are skipped without poisoning the average', () => {
  const out = summarizeSegments([
    null,
    'not a segment',
    { start: 0, end: 1, avg_logprob: 'very confident', no_speech_prob: 0.1 },
    seg(1, 2, -0.4, 0.2),
  ]);
  // Only the last segment has a usable logprob; both usable no_speech_probs
  // are averaged.
  assertEquals(out.avgLogprob, -0.4);
  assert(out.noSpeechProb !== null);
  assertEquals(Math.round(out.noSpeechProb * 100) / 100, 0.15);
});

Deno.test('non-finite numbers are treated as unreported', () => {
  const out = summarizeSegments([
    { start: 0, end: 1, avg_logprob: NaN, no_speech_prob: Infinity },
    seg(1, 2, -0.6, 0.25),
  ]);
  assertEquals(out.avgLogprob, -0.6);
  assertEquals(out.noSpeechProb, 0.25);
});
