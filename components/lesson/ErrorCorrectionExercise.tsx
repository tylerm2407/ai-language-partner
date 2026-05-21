import { useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FeedbackCard } from './FeedbackCard';
import { HighlightedText } from '../shared/HighlightedText';
import { Body, Caption } from '../ui/Text';
import { colors, spacing, radii } from '../../config/theme';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import type { Exercise } from '../../types';

interface Props {
  exercise: Exercise;
  onAnswer: (isCorrect: boolean, answer: string) => void;
  userId?: string;
  language?: string;
  cefrLevel?: string;
  onContinue?: () => void;
}

export function ErrorCorrectionExercise({
  exercise,
  onAnswer,
  userId,
  language,
  cefrLevel,
  onContinue,
}: Props) {
  const [userInput, setUserInput] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);

  const errorSentence = (exercise.metadata?.error_sentence as string) ?? exercise.prompt;
  const highlight = exercise.targetWord ?? exercise.targetGrammar;

  const handleCheck = () => {
    const grade = gradeAnswer(userInput, exercise.correctAnswer, exercise.acceptedAnswers, {
      exerciseHints: {
        exerciseType: exercise.type,
        skillType: exercise.skillType,
        targetGrammar: exercise.targetGrammar,
        targetWord: exercise.targetWord,
      },
    });
    setResult(grade);
    setIsRevealed(true);

    if (grade.isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    onAnswer(grade.isCorrect, userInput);
  };

  const handleRetry = () => {
    setUserInput('');
    setIsRevealed(false);
    setResult(null);
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
      {result && isRevealed && language && onContinue ? (
        <FeedbackCard
          result={result}
          exercise={exercise}
          language={language}
          cefrLevel={cefrLevel}
          userId={userId}
          onRetry={handleRetry}
          onContinue={onContinue}
        />
      ) : null}

      {/* Button */}
      {!isRevealed && (
        <Pressable
          onPress={handleCheck}
          disabled={userInput.trim().length === 0}
          style={{
            backgroundColor: userInput.trim().length > 0 ? colors.indigo[500] : colors.indigo[200],
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
