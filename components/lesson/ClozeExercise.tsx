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

export function ClozeExercise({
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

  // The prompt contains the sentence with "___" as the blank
  const parts = exercise.prompt.split('___');
  const beforeBlank = parts[0] ?? '';
  const afterBlank = parts[1] ?? '';

  const highlight = exercise.targetWord ?? exercise.targetGrammar;

  const handleCheck = () => {
    if (!userInput.trim() || isRevealed) return;

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
    // Notify parent — this exercise historically deferred onAnswer to the
    // Continue button; updating now so LessonRunner can trigger its own
    // visual effects (sparkle / shake) without a two-step tap.
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
        Fill in the blank
      </Caption>

      {/* Context sentence with blank */}
      <View style={{
        backgroundColor: colors.surface.cardAlt, borderRadius: radii.xxl, padding: spacing.lg, marginBottom: spacing.lg + spacing.xxs, minHeight: 120,
        justifyContent: 'center',
      }}>
        <Body size="lg" style={{ lineHeight: 28 }}>
          <HighlightedText text={beforeBlank} highlight={highlight} />
          <View style={{
            borderBottomWidth: 2,
            borderBottomColor: isRevealed ? (isCorrect ? colors.success.base : colors.error.base) : colors.indigo[500],
            minWidth: 80,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {isRevealed && (
                <Ionicons
                  name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={isCorrect ? colors.success.base : colors.error.base}
                  style={{ marginRight: spacing.xxs }}
                />
              )}
              <Body size="lg" weight="semibold" style={{
                color: isRevealed ? (isCorrect ? colors.success.base : colors.error.base) : colors.indigo[500],
                textAlign: 'center',
                paddingHorizontal: spacing.xxs,
              }}>
                {isRevealed ? (isCorrect ? userInput : exercise.correctAnswer) : userInput || '___'}
              </Body>
            </View>
          </View>
          <HighlightedText text={afterBlank} highlight={highlight} />
        </Body>
      </View>

      {/* Input */}
      {!isRevealed && (
        <TextInput
          value={userInput}
          onChangeText={setUserInput}
          placeholder="Type the missing word..."
          placeholderTextColor={colors.text.quaternary}
          autoFocus
          style={{
            borderWidth: 2,
            borderColor: colors.border.strong,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            fontSize: 18,
            fontWeight: '600',
            textAlign: 'center',
            color: colors.text.primary,
            marginBottom: spacing.md,
          }}
          accessibilityLabel="Missing word"
        />
      )}

      {/* Hint */}
      {exercise.hintText && !isRevealed && (
        <Caption tone="tertiary" style={{ fontStyle: 'italic', marginBottom: spacing.md }}>
          Hint: {exercise.hintText}
        </Caption>
      )}

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

      {/* Check button — only before revealing */}
      {!isRevealed && (
        <Pressable
          onPress={handleCheck}
          disabled={userInput.trim().length === 0}
          style={{
            backgroundColor: userInput.trim().length > 0 ? colors.indigo[500] : colors.indigo[200],
            paddingVertical: spacing.md,
            borderRadius: radii.lg,
            alignItems: 'center',
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
