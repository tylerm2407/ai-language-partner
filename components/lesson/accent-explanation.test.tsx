import React from 'react';
import TestRenderer from 'react-test-renderer';
import { FeedbackCard } from './FeedbackCard';
import { Ui2VariantProvider } from '../../hooks/useUi2Theme';
import { gradeAnswer } from '../../lib/grading';
import type { Exercise } from '../../types';

/**
 * An accent that distinguishes two taught words must not be explained as a
 * typo, and the explanation that names both words must not arrive early.
 *
 * Found by looking at a simulator rather than by a test: the refusal worked,
 * and the card above it said "Small typo" — telling the learner the mistake was
 * trivial in the same breath as rejecting it. Nothing here asserted which card
 * rendered the grader's verdict, only that the verdict was right.
 */
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({ playing: false, loading: false, error: null, play: jest.fn() }),
}));
jest.mock('./RuleCard', () => ({ RuleCard: () => null }));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock('../../lib/supabase-queries', () => ({ logExerciseCorrection: jest.fn(async () => {}) }));

const exercise: Exercise = {
  id: 'aabbccdd-5555-1006-0003-e00000000006',
  lessonId: 'pt-a1-family',
  type: 'translate_to_target',
  orderIndex: 0,
  prompt: 'Translate to Portuguese: Grandfather',
  promptAudioUrl: null,
  correctAnswer: 'Avô',
  acceptedAnswers: [],
  options: null,
  hintText: null,
  cardId: null,
} as unknown as Exercise;

/** The real grader, not a fixture: the point is what a learner actually gets. */
const result = gradeAnswer('avo', exercise.correctAnswer, [], {
  exerciseHints: { exerciseType: 'translate_to_target', language: 'pt' },
});

const textOf = (revealAnswer: boolean) => {
  let tree!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    tree = TestRenderer.create(
      <Ui2VariantProvider variant="system">
        <FeedbackCard result={result} exercise={exercise} language="pt" revealAnswer={revealAnswer} />
      </Ui2VariantProvider>,
    );
  });
  return JSON.stringify(tree.toJSON());
};

describe('an accent that carries the meaning', () => {
  it('is refused, and is not classified as a spelling slip', () => {
    expect(result.isCorrect).toBe(false);
    // 'spelling' routes to a card headed "Small typo". These are two words.
    expect(result.errorType).toBe('lexical');
  });

  it('explains itself by naming both words once the answer is revealed', () => {
    const shown = textOf(true);
    expect(shown).toContain('The accent is the whole difference');
    expect(shown).toContain('Avô');
    expect(shown).toContain('Avó');
    // The generic cue is replaced, not appended.
    expect(shown).not.toContain('something else fits better');
    expect(shown).not.toContain('Small typo');
  });

  it('withholds that explanation while a second attempt is still open', () => {
    // It names the correct answer, so showing it early hands over the answer
    // and a second chance stops being one.
    const early = textOf(false);
    expect(early).not.toContain('The accent is the whole difference');
    expect(early).not.toContain('Avó');
    expect(early).toContain('something else fits better');
  });
});
