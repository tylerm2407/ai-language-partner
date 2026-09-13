import {
  applyChoiceResult,
  buildChoiceOptions,
  CHOICE_FAST_MS,
  CHOICE_MAX_REASKS,
  choiceRating,
  createChoiceSession,
  currentId,
  isComplete,
  isFirstAttempt,
  shuffle,
} from './review-choices';
import type { Card } from '../types';

function card(id: string, nativeText: string, over: Partial<Card> = {}): Card {
  return {
    id,
    courseId: 'course-es',
    unitId: null,
    nativeText,
    targetText: `${id}-target`,
    audioUrl: null,
    imageUrl: null,
    exampleSentence: null,
    exampleSentenceTranslation: null,
    partOfSpeech: null,
    tags: [],
    createdAt: '2026-01-01T00:00:00Z',
    language: 'es',
    ...over,
  };
}

/** Deterministic rng: identity shuffle (always picks the last index). */
const noShuffle = () => 0.999999;

describe('buildChoiceOptions', () => {
  const target = card('c1', 'the dog');

  it('returns the correct answer plus three distractors from the pool', () => {
    const pool = [target, card('c2', 'the cat'), card('c3', 'the house'), card('c4', 'the car'), card('c5', 'the tree')];
    const options = buildChoiceOptions(target, pool, noShuffle);
    expect(options).toHaveLength(4);
    expect(options).toContain('the dog');
    expect(new Set(options).size).toBe(4);
  });

  it('never offers the correct translation twice, case- and space-insensitively', () => {
    const pool = [card('c2', ' The Dog '), card('c3', 'the cat'), card('c4', 'the house')];
    const options = buildChoiceOptions(target, pool, noShuffle);
    expect(options.filter((o) => o.trim().toLowerCase() === 'the dog')).toHaveLength(1);
    expect(options).toHaveLength(3);
  });

  it('collapses pool cards that share a translation', () => {
    const pool = [card('c2', 'the bank'), card('c3', 'the bank'), card('c4', 'the cat')];
    const options = buildChoiceOptions(target, pool, noShuffle);
    expect(options.sort()).toEqual(['the bank', 'the cat', 'the dog']);
  });

  it('prefers same-language cards and only then falls back to others', () => {
    const pool = [
      card('fr1', 'the bread', { language: 'fr' }),
      card('fr2', 'the wine', { language: 'fr' }),
      card('es1', 'the cat'),
      card('es2', 'the house'),
    ];
    const options = buildChoiceOptions(target, pool, noShuffle);
    expect(options).toHaveLength(4);
    expect(options).toEqual(expect.arrayContaining(['the cat', 'the house', 'the dog']));
    // Exactly one of the French cards fills the remaining slot.
    expect(options.filter((o) => o === 'the bread' || o === 'the wine')).toHaveLength(1);
  });

  it('returns only the correct answer when the pool is empty', () => {
    expect(buildChoiceOptions(target, [], noShuffle)).toEqual(['the dog']);
  });

  it('excludes the card itself from the pool', () => {
    expect(buildChoiceOptions(target, [target], noShuffle)).toEqual(['the dog']);
  });

  it('shuffles: the correct answer is not pinned to a position', () => {
    const pool = [card('c2', 'a'), card('c3', 'b'), card('c4', 'c')];
    const positions = new Set<number>();
    let seed = 1;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 50; i += 1) positions.add(buildChoiceOptions(target, pool, rng).indexOf('the dog'));
    expect(positions.size).toBeGreaterThan(1);
  });
});

describe('shuffle', () => {
  it('does not mutate its input and keeps every element', () => {
    const input = [1, 2, 3, 4];
    const out = shuffle(input, () => 0);
    expect(input).toEqual([1, 2, 3, 4]);
    expect([...out].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('choiceRating', () => {
  it('a miss is Again regardless of speed', () => {
    expect(choiceRating(false, 100)).toBe(1);
    expect(choiceRating(false, 60_000)).toBe(1);
  });
  it('a fast hit is Easy, a slow hit is Good', () => {
    expect(choiceRating(true, CHOICE_FAST_MS - 1)).toBe(5);
    expect(choiceRating(true, CHOICE_FAST_MS)).toBe(4);
    expect(choiceRating(true, 20_000)).toBe(4);
  });
  it('never yields Hard: a choice is recognised or it is not', () => {
    for (const ms of [0, 1000, 3999, 4000, 9000]) {
      expect([1, 4, 5]).toContain(choiceRating(true, ms));
    }
  });
});

describe('ChoiceSession', () => {
  it('a correct pick retires the card and advances', () => {
    let s = createChoiceSession(['a', 'b']);
    expect(currentId(s)).toBe('a');
    s = applyChoiceResult(s, 'a', true);
    expect(currentId(s)).toBe('b');
    expect(s.resolved).toBe(1);
    expect(isComplete(s)).toBe(false);
    s = applyChoiceResult(s, 'b', true);
    expect(isComplete(s)).toBe(true);
    expect(s.resolved).toBe(2);
  });

  it('a miss sends the card to the back of the queue, unresolved', () => {
    let s = createChoiceSession(['a', 'b', 'c']);
    s = applyChoiceResult(s, 'a', false);
    expect(s.queue).toEqual(['b', 'c', 'a']);
    expect(s.resolved).toBe(0);
  });

  it('only the first showing of a card is a real review', () => {
    let s = createChoiceSession(['a', 'b']);
    expect(isFirstAttempt(s, 'a')).toBe(true);
    s = applyChoiceResult(s, 'a', false);
    s = applyChoiceResult(s, 'b', true);
    expect(currentId(s)).toBe('a');
    expect(isFirstAttempt(s, 'a')).toBe(false);
  });

  it('the last card missed comes straight back — nothing to interleave', () => {
    let s = createChoiceSession(['a']);
    s = applyChoiceResult(s, 'a', false);
    expect(currentId(s)).toBe('a');
    expect(isComplete(s)).toBe(false);
    s = applyChoiceResult(s, 'a', true);
    expect(isComplete(s)).toBe(true);
  });

  it(`gives up on a card after ${CHOICE_MAX_REASKS} re-asks`, () => {
    let s = createChoiceSession(['a']);
    for (let i = 0; i <= CHOICE_MAX_REASKS; i += 1) s = applyChoiceResult(s, 'a', false);
    expect(isComplete(s)).toBe(true);
    expect(s.resolved).toBe(1);
    expect(s.attempts.a).toBe(CHOICE_MAX_REASKS + 1);
  });

  it('ignores a result for a card that is not at the front', () => {
    const s = createChoiceSession(['a', 'b']);
    expect(applyChoiceResult(s, 'b', true)).toBe(s);
  });

  it('an empty session is not complete', () => {
    expect(isComplete(createChoiceSession([]))).toBe(false);
  });
});
