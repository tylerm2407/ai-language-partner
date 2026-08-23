import {
  exerciseHints,
  isRestored,
  parseSpeakingScore,
  regradePick,
  restorePlacedTiles,
  splitJoinedAnswer,
} from './exercise-restore';
import type { Exercise } from '../types';

const exercise: Exercise = {
  id: 'ex-1',
  lessonId: 'lesson-1',
  type: 'translate_to_target',
  orderIndex: 0,
  prompt: 'the water',
  promptAudioUrl: null,
  correctAnswer: 'el agua',
  acceptedAnswers: ['agua'],
  options: null,
  hintText: null,
  cardId: null,
  targetWord: 'agua',
};

describe('isRestored', () => {
  it('separates a recorded answer from the absence of one', () => {
    expect(isRestored('el agua')).toBe(true);
    expect(isRestored(null)).toBe(false);
    expect(isRestored(undefined)).toBe(false);
  });

  it('treats an empty submission as a real answer', () => {
    // Submitting nothing is still an answer the learner gave, and the note
    // row and Next button must reflect that on the way back.
    expect(isRestored('')).toBe(true);
  });
});

describe('regradePick', () => {
  it('returns null when there is nothing to restore', () => {
    expect(regradePick(exercise, null)).toBeNull();
    expect(regradePick(exercise, undefined)).toBeNull();
  });

  it('reproduces the grade the learner originally saw', () => {
    expect(regradePick(exercise, 'el agua')?.isCorrect).toBe(true);
    expect(regradePick(exercise, 'agua')?.isCorrect).toBe(true);
    expect(regradePick(exercise, 'la leche')?.isCorrect).toBe(false);
  });

  it('carries the error classification back with it', () => {
    const graded = regradePick(exercise, 'la leche');
    expect(graded?.errorType).toBeDefined();
    expect(graded?.normalizedUserAnswer).toBeTruthy();
  });
});

describe('exerciseHints', () => {
  it('forwards the fields the classifier reads', () => {
    expect(exerciseHints(exercise)).toEqual({
      exerciseType: 'translate_to_target',
      skillType: undefined,
      targetGrammar: undefined,
      targetWord: 'agua',
    });
  });
});

describe('splitJoinedAnswer', () => {
  it('splits a composite answer on its own separator', () => {
    expect(splitJoinedAnswer('hacer, tomar', ', ')).toEqual(['hacer', 'tomar']);
    expect(splitJoinedAnswer('uno | dos | tres', ' | ')).toEqual(['uno', 'dos', 'tres']);
  });

  it('returns nothing for a missing or empty answer', () => {
    expect(splitJoinedAnswer(null, ', ')).toEqual([]);
    expect(splitJoinedAnswer(undefined, ', ')).toEqual([]);
    expect(splitJoinedAnswer('', ', ')).toEqual([]);
  });
});

describe('restorePlacedTiles', () => {
  it('maps a sentence back onto tile indices', () => {
    const tiles = ['agua', 'el', 'fría', 'está'];
    expect(restorePlacedTiles(tiles, 'el agua está fría')).toEqual([1, 0, 3, 2]);
  });

  it('consumes a repeated word once per tile', () => {
    const tiles = ['de', 'casa', 'la', 'de'];
    expect(restorePlacedTiles(tiles, 'de la casa de')).toEqual([0, 2, 1, 3]);
  });

  it('restores nothing rather than half a sentence when a tile is missing', () => {
    // A partial restore would leave the learner in a state they could not
    // have built themselves.
    const tiles = ['el', 'agua'];
    expect(restorePlacedTiles(tiles, 'el agua fría')).toEqual([]);
  });

  it('restores nothing when a word repeats more often than its tiles do', () => {
    expect(restorePlacedTiles(['de', 'casa'], 'de de casa')).toEqual([]);
  });

  it('returns an empty placement for a missing answer', () => {
    expect(restorePlacedTiles(['el', 'agua'], null)).toEqual([]);
    expect(restorePlacedTiles(['el', 'agua'], '')).toEqual([]);
  });
});

describe('parseSpeakingScore', () => {
  it('pulls the score out of the encoded answer', () => {
    expect(parseSpeakingScore('score:82')).toBe(82);
    expect(parseSpeakingScore('score:0')).toBe(0);
    expect(parseSpeakingScore('score:73.5')).toBe(73.5);
  });

  it('returns null for anything that is not a score', () => {
    expect(parseSpeakingScore(null)).toBeNull();
    expect(parseSpeakingScore(undefined)).toBeNull();
    expect(parseSpeakingScore('')).toBeNull();
    expect(parseSpeakingScore('el agua')).toBeNull();
    expect(parseSpeakingScore('score:')).toBeNull();
    expect(parseSpeakingScore('score:abc')).toBeNull();
  });
});
