import React from 'react';
import TestRenderer from 'react-test-renderer';
import { FeedbackCard } from './FeedbackCard';
import { Ui2VariantProvider } from '../../hooks/useUi2Theme';
import { gradeAnswer } from '../../lib/grading';
import type { Exercise } from '../../types';

/**
 * A learner who writes a Japanese word in kana is right, and should still be
 * shown its kanji.
 *
 * The correct branch of this card renders nothing as a rule, because the
 * chrome's footer already says CORRECT and prints the exercise's authored
 * explanation. The grader can know something the exercise does not, though —
 * that this answer was a reading, and here is the spelling — and the footer has
 * no route for that. This is the one case the correct branch draws.
 */
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({ playing: false, loading: false, error: null, play: jest.fn() }),
}));
jest.mock('./RuleCard', () => ({ RuleCard: () => null }));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock('../../lib/supabase-queries', () => ({ logExerciseCorrection: jest.fn(async () => {}) }));

const exercise: Exercise = {
  id: 'aabbccdd-6666-1002-0001-000000000000',
  lessonId: 'ja-a1-food',
  type: 'translate_to_target',
  orderIndex: 0,
  prompt: 'Translate to Japanese: Fish',
  promptAudioUrl: null,
  correctAnswer: '魚',
  acceptedAnswers: [],
  options: null,
  hintText: null,
  cardId: null,
} as unknown as Exercise;

/** The real grader: the point is what a learner actually gets. */
const kanaAnswer = gradeAnswer('さかな', exercise.correctAnswer, [], {
  exerciseHints: { exerciseType: 'translate_to_target', language: 'ja', skillType: 'vocabulary' },
});
const kanjiAnswer = gradeAnswer('魚', exercise.correctAnswer, [], {
  exerciseHints: { exerciseType: 'translate_to_target', language: 'ja', skillType: 'vocabulary' },
});

const textOf = (result: typeof kanaAnswer, revealAnswer: boolean) => {
  let tree!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    tree = TestRenderer.create(
      <Ui2VariantProvider variant="system">
        <FeedbackCard result={result} exercise={exercise} language="ja" revealAnswer={revealAnswer} />
      </Ui2VariantProvider>,
    );
  });
  return JSON.stringify(tree.toJSON());
};

describe('a kana answer to a kanji row', () => {
  it('is correct', () => {
    expect(kanaAnswer.isCorrect).toBe(true);
    expect(kanaAnswer.accuracy).toBe(1);
  });

  it('shows the kanji spelling once the answer is revealed', () => {
    expect(textOf(kanaAnswer, true)).toContain('魚');
  });

  it('says nothing extra when the learner already wrote the kanji', () => {
    // No spelling left to teach, so the card stays silent as it always has.
    expect(kanjiAnswer.isCorrect).toBe(true);
    expect(textOf(kanjiAnswer, true)).toBe('null');
  });

  it('stays silent before the reveal', () => {
    expect(textOf(kanaAnswer, false)).toBe('null');
  });
});
