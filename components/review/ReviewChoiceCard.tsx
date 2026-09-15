/**
 * One review card as a four-option question.
 *
 * Wraps the lesson's MultipleChoice so the review reads exactly like the
 * recognition exercise the learner already knows — same rows, same
 * CORRECT / YOUR PICK verdict, same key tiles — instead of a second visual
 * language for the same act. The synthetic Exercise it builds is never
 * persisted; it exists so MultipleChoice can grade the pick.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import { MultipleChoice } from '../lesson/MultipleChoice';
import { SlabButton } from '../ui2/SlabButton';
import { Body, Caption } from '../ui2/Ui2Text';
import { spacing } from '../../config/theme';
import type { Card, Exercise } from '../../types';

interface ReviewChoiceCardProps {
  card: Card;
  /** Shuffled options, correct answer included. See buildChoiceOptions. */
  options: string[];
  selected: string | null;
  onAnswer: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  /** Disables Continue while the review is being written. */
  busy?: boolean;
  /** Second or later showing this session — labelled so the learner knows. */
  reask?: boolean;
}

export function ReviewChoiceCard({
  card,
  options,
  selected,
  onAnswer,
  onContinue,
  busy,
  reask,
}: ReviewChoiceCardProps) {
  const exercise = useMemo<Exercise>(() => ({
    id: `review-${card.id}`,
    lessonId: 'review',
    type: 'translate_to_native',
    orderIndex: 0,
    prompt: card.targetText,
    promptAudioUrl: card.audioUrl,
    correctAnswer: card.nativeText,
    acceptedAnswers: [card.nativeText],
    options,
    hintText: null,
    cardId: card.id,
    skillType: card.skillType,
    subskill: card.subskill,
    targetWord: card.targetText,
  }), [card, options]);

  const answered = selected !== null;
  const wasCorrect = answered && selected.trim().toLowerCase() === card.nativeText.trim().toLowerCase();

  return (
    <View style={{ gap: spacing.lg }}>
      {reask && (
        <Caption size="sm" tone="tertiary" accessibilityLiveRegion="polite">
          Once more — you missed this one earlier.
        </Caption>
      )}
      {/* userId is deliberately NOT passed: MultipleChoice would write a
          correction_log row per miss, and review_logs already records every
          review with was_correct. One source of truth per event. */}
      <MultipleChoice
        exercise={exercise}
        selected={selected}
        onAnswer={onAnswer}
        showResult={answered}
        language={card.language}
      />
      {answered && (
        <View style={{ gap: spacing.sm }}>
          {card.exampleSentence && (
            <Body size="sm" tone="secondary" style={{ fontStyle: 'italic' }}>
              {card.exampleSentence}
            </Body>
          )}
          {card.exampleSentenceTranslation && (
            <Caption size="sm" tone="tertiary">{card.exampleSentenceTranslation}</Caption>
          )}
          <SlabButton
            label={wasCorrect ? 'Continue' : 'Got it'}
            onPress={onContinue}
            disabled={busy}
            loading={busy}
            accessibilityHint={wasCorrect ? 'Next card' : 'You will see this card again before the session ends'}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      )}
    </View>
  );
}
