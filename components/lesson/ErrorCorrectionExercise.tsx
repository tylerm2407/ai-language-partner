import { useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { FeedbackCard } from './FeedbackCard';
import { HighlightedText } from '../shared/HighlightedText';
import { Body, Caption } from '../ui/Text';
import { colors, spacing, radii } from '../../config/theme';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import { isRestored, regradePick } from '../../lib/exercise-restore';
import type { Exercise, LanguageCode } from '../../types';

interface Props {
  exercise: Exercise;
  onAnswer: (isCorrect: boolean, answer: string) => void;
  /**
   * The runner has resolved this exercise — render read-only, and let the
   * FeedbackCard reveal the answer. False while a second attempt is open.
   */
  showResult: boolean;
  /** Previously recorded answer, restored by the runner on Previous. */
  selected?: string | null;
  userId?: string;
  language?: string;
  cefrLevel?: string;
}

export function ErrorCorrectionExercise({
  exercise,
  onAnswer,
  showResult,
  selected = null,
  userId,
  language,
  cefrLevel,
}: Props) {
  // Seeded from the recorded pick so Previous comes back to the answer the
  // learner actually gave, in its graded state — see lib/exercise-restore.ts.
  const [userInput, setUserInput] = useState(selected ?? '');
  const [localRevealed, setLocalRevealed] = useState(() => isRestored(selected));
  /**
   * Locked = this exercise's own reveal, OR the runner saying it is resolved
   * (walked back onto, or out of attempts). The runner's word has to be able
   * to lock it too, or a second attempt could not be handed back.
   */
  const isRevealed = localRevealed || showResult;
  const [result, setResult] = useState<GradeResult | null>(() =>
    regradePick(exercise, selected),
  );

  const errorSentence = (exercise.metadata?.error_sentence as string) ?? exercise.prompt;
  const highlight = exercise.targetWord ?? exercise.targetGrammar;

  const handleCheck = () => {
    if (!userInput.trim() || isRevealed) return;

    const grade = gradeAnswer(userInput, exercise.correctAnswer, exercise.acceptedAnswers, {
      exerciseHints: {
        exerciseType: exercise.type,
        skillType: exercise.skillType,
        targetGrammar: exercise.targetGrammar,
        targetWord: exercise.targetWord,
        language: language as LanguageCode | undefined,
      },
    });
    setResult(grade);
    setLocalRevealed(true);

    haptic(grade.isCorrect ? 'correct' : 'incorrect');
    onAnswer(grade.isCorrect, userInput);
  };


  const isCorrect = result?.isCorrect ?? false;

  return (
    <View style={{ flex: 1 }}>
      <Caption tone="accent" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
        Find and fix the error
      </Caption>

      {/* Sentence with error */}
      <View style={{
        backgroundColor: colors.error.tint, borderRadius: radii.xxl, padding: spacing.lg, marginBottom: spacing.lg + spacing.xxs, minHeight: 100,
        justifyContent: 'center',
      }}>
        <HighlightedText
          text={errorSentence}
          highlight={highlight}
          className="text-text-primary text-[18px] leading-7"
        />
        <Caption tone="error" style={{ marginTop: spacing.xs, fontStyle: 'italic' }}>
          This sentence contains an error. Type the corrected version below.
        </Caption>
      </View>

      {/* Corrected Input */}
      <View>
        <TextInput
          value={userInput}
          onChangeText={setUserInput}
          placeholder="Type the corrected sentence..."
          placeholderTextColor={colors.text.quaternary}
          editable={!isRevealed}
          multiline
          style={{
            borderWidth: 2,
            borderColor: isRevealed ? (isCorrect ? colors.success.base : colors.error.base) : colors.border.strong,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            fontSize: 16,
            minHeight: 80,
            textAlignVertical: 'top',
            color: colors.text.primary,
            marginBottom: spacing.md,
          }}
          accessibilityLabel="Corrected sentence"
        />
        {isRevealed && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <Ionicons
              name={isCorrect ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={isCorrect ? colors.success.base : colors.error.base}
              style={{ marginRight: spacing.xxs }}
            />
            <Caption style={{ color: isCorrect ? colors.success.base : colors.error.base }}>
              {isCorrect ? 'Correct' : 'Incorrect'}
            </Caption>
          </View>
        )}
      </View>

      {/* Differentiated feedback */}
      {result && isRevealed && language ? (
        <FeedbackCard
          result={result}
          exercise={exercise}
          language={language}
          cefrLevel={cefrLevel}
          userId={userId}
          revealAnswer={showResult}
        />
      ) : null}

      {/* Button */}
      {!isRevealed && (
        <Pressable
          onPress={handleCheck}
          disabled={userInput.trim().length === 0}
          style={{
            backgroundColor: userInput.trim().length > 0 ? colors.action.primaryFill : colors.indigo[200],
            paddingVertical: spacing.md, borderRadius: radii.lg, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Check answer"
        >
          <Body size="lg" weight="semibold" tone="onPrimary">Check</Body>
        </Pressable>
      )}
    </View>
  );
}
