/**
 * Unit tests for hands-free answer evaluation.
 *
 * The invariant these protect: an answer we are not confident we heard must
 * never produce a rating. Everything else here is secondary.
 */

import {
  HANDSFREE_MIN_CONFIDENCE,
  NEUTRAL_CONFIDENCE,
  evaluateHandsFreeAnswer,
  sttConfidence,
  type HandsFreeGradeInput,
} from './handsfree-grading';
import { speechScoreToRating } from './grading';

function input(overrides: Partial<HandsFreeGradeInput> = {}): HandsFreeGradeInput {
  return {
    transcript: 'la manzana',
    expectedText: 'la manzana',
    acceptedVariants: [],
    responseTimeMs: 2500,
    endpointerLagMs: 1200,
    confidence: 0.9,
    ...overrides,
  };
}

describe('sttConfidence', () => {
  it('is zero for an empty transcript whatever else is reported', () => {
    expect(
      sttConfidence({ noSpeechProb: 0, avgLogprob: -0.05, transcript: '', speechDurationMs: 0 }),
    ).toBe(0);
    expect(
      sttConfidence({ noSpeechProb: 0, avgLogprob: -0.05, transcript: '   ', speechDurationMs: 0 }),
    ).toBe(0);
  });

  it('degrades to neutral when the provider reports nothing', () => {
    // transcribe does not surface these fields yet. Failing closed here would
    // make every hands-free turn unusable.
    expect(
      sttConfidence({
        noSpeechProb: null,
        avgLogprob: null,
        transcript: 'la manzana',
        speechDurationMs: 900,
      }),
    ).toBe(NEUTRAL_CONFIDENCE);
  });

  it('keeps the neutral default above the rejection threshold', () => {
    // Otherwise adding the gate before the signal would reject everything.
    expect(NEUTRAL_CONFIDENCE).toBeGreaterThan(HANDSFREE_MIN_CONFIDENCE);
  });

  it('falls as the silence probability rises', () => {
    const at = (p: number) =>
      sttConfidence({ noSpeechProb: p, avgLogprob: null, transcript: 'x', speechDurationMs: 500 });
    expect(at(0.0)).toBeGreaterThan(at(0.5));
    expect(at(0.5)).toBeGreaterThan(at(0.95));
    expect(at(0.95)).toBeLessThan(HANDSFREE_MIN_CONFIDENCE);
  });

  it('falls as the mean log-probability drops', () => {
    const at = (lp: number) =>
      sttConfidence({ noSpeechProb: null, avgLogprob: lp, transcript: 'x', speechDurationMs: 500 });
    expect(at(-0.1)).toBeCloseTo(1, 2);
    expect(at(-1.0)).toBeCloseTo(0, 2);
    expect(at(-0.5)).toBeGreaterThan(at(-0.8));
  });

  it('takes the weakest signal when two disagree', () => {
    // Confident-sounding tokens inside a clip Whisper thinks is silence is a
    // classic hallucination signature; the pessimistic reading is correct.
    const c = sttConfidence({
      noSpeechProb: 0.9,
      avgLogprob: -0.1,
      transcript: 'la manzana',
      speechDurationMs: 800,
    });
    expect(c).toBeCloseTo(0.1, 2);
  });

  it('clamps out-of-range provider values', () => {
    const c = sttConfidence({
      noSpeechProb: 1.5,
      avgLogprob: 2,
      transcript: 'x',
      speechDurationMs: 100,
    });
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });

  it('ignores non-finite values rather than producing NaN', () => {
    const c = sttConfidence({
      noSpeechProb: Number.NaN,
      avgLogprob: Number.NaN,
      transcript: 'x',
      speechDurationMs: 100,
    });
    expect(Number.isNaN(c)).toBe(false);
    expect(c).toBe(NEUTRAL_CONFIDENCE);
  });
});

describe('refusing to grade', () => {
  it('declines an empty transcript', () => {
    expect(evaluateHandsFreeAnswer(input({ transcript: '  ' }))).toEqual({
      kind: 'low_confidence',
      reason: 'empty',
    });
  });

  it('declines a low-confidence transcript even when it would have scored well', () => {
    // This is the whole point: the words matched, but we do not trust that we
    // heard them, so the card keeps its schedule instead of being rated.
    const result = evaluateHandsFreeAnswer(
      input({ transcript: 'la manzana', confidence: 0.2 }),
    );
    expect(result).toEqual({ kind: 'low_confidence', reason: 'stt' });
  });

  it('declines a low-confidence transcript that would have scored badly', () => {
    // The more dangerous direction — this is the one that would demote a card
    // the learner actually knew.
    const result = evaluateHandsFreeAnswer(
      input({ transcript: 'brrm brrm', confidence: 0.1 }),
    );
    expect(result.kind).toBe('low_confidence');
  });

  it('grades exactly at the threshold', () => {
    const result = evaluateHandsFreeAnswer(
      input({ confidence: HANDSFREE_MIN_CONFIDENCE }),
    );
    expect(result.kind).toBe('graded');
  });
});

describe('grading', () => {
  it('accepts an exact answer', () => {
    const result = evaluateHandsFreeAnswer(input());
    expect(result).toMatchObject({ kind: 'graded', wasCorrect: true, phraseKey: 'correct' });
  });

  it('accepts an accepted variant', () => {
    const result = evaluateHandsFreeAnswer(
      input({ transcript: 'manzana', expectedText: 'la manzana', acceptedVariants: ['manzana'] }),
    );
    expect(result).toMatchObject({ kind: 'graded', wasCorrect: true });
  });

  it('distinguishes a near miss from a total miss', () => {
    const near = evaluateHandsFreeAnswer(
      input({ transcript: 'la manzena', expectedText: 'la manzana' }),
    );
    const far = evaluateHandsFreeAnswer(
      input({ transcript: 'completely different words', expectedText: 'la manzana' }),
    );
    if (near.kind !== 'graded' || far.kind !== 'graded') throw new Error('expected grades');
    expect(near.score).toBeGreaterThan(far.score);
    expect(far.phraseKey).toBe('incorrect');
  });

  it('subtracts endpointer lag before judging speed', () => {
    // 4.4s raw is "slow" against a 3.5s threshold, but 1.2s of that was the
    // detector waiting for silence. Without the subtraction a 5 would be
    // nearly unreachable and every interval would grow more slowly.
    const withLag = evaluateHandsFreeAnswer(
      input({ responseTimeMs: 4400, endpointerLagMs: 1200 }),
    );
    const withoutLag = evaluateHandsFreeAnswer(
      input({ responseTimeMs: 4400, endpointerLagMs: 0 }),
    );
    if (withLag.kind !== 'graded' || withoutLag.kind !== 'graded') throw new Error('expected');
    expect(withLag.rating).toBeGreaterThan(withoutLag.rating);
  });

  it('never returns a negative thinking time', () => {
    const result = evaluateHandsFreeAnswer(
      input({ responseTimeMs: 500, endpointerLagMs: 1200 }),
    );
    expect(result.kind).toBe('graded');
  });
});

describe('speechScoreToRating', () => {
  it('maps the score bands', () => {
    expect(speechScoreToRating(10, 0)).toBe(1);
    expect(speechScoreToRating(50, 0)).toBe(2);
    expect(speechScoreToRating(70, 0)).toBe(3);
    expect(speechScoreToRating(85, 0)).toBe(4);
    expect(speechScoreToRating(100, 0)).toBe(5);
  });

  it('puts the pass boundary at 60, matching gradeSpeechTranscription', () => {
    // SM-2 treats <3 as a lapse, so the rating boundary and the isCorrect
    // boundary have to be the same number or the two disagree about failure.
    expect(speechScoreToRating(59, 0)).toBeLessThan(3);
    expect(speechScoreToRating(60, 0)).toBeGreaterThanOrEqual(3);
  });

  it('withholds the top rating when the answer was slow', () => {
    expect(speechScoreToRating(100, 10_000)).toBe(4);
  });

  it('is monotonic in score', () => {
    let previous = 0;
    for (let score = 0; score <= 100; score += 5) {
      const rating = speechScoreToRating(score, 0);
      expect(rating).toBeGreaterThanOrEqual(previous);
      previous = rating;
    }
  });
});
