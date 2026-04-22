import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FeedbackCard } from './FeedbackCard';
import { HighlightedText } from '../shared/HighlightedText';
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
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#6366F1', marginBottom: 8 }}>
        Fill in the blank
      </Text>

      {/* Context sentence with blank */}
      <View style={{
        backgroundColor: '#F9FAFB', borderRadius: 20, padding: 24, marginBottom: 20, minHeight: 120,
        justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 18, lineHeight: 28, color: '#111' }}>
          <HighlightedText text={beforeBlank} highlight={highlight} />
          <View style={{
            borderBottomWidth: 2,
            borderBottomColor: isRevealed ? (isCorrect ? '#22C55E' : '#EF4444') : '#6366F1',
            minWidth: 80,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: isRevealed ? (isCorrect ? '#22C55E' : '#EF4444') : '#6366F1',
              textAlign: 'center',
              paddingHorizontal: 4,
            }}>
              {isRevealed ? (isCorrect ? userInput : exercise.correctAnswer) : userInput || '___'}
            </Text>
          </View>
          <HighlightedText text={afterBlank} highlight={highlight} />
        </Text>
      </View>

      {/* Input */}
      {!isRevealed && (
        <TextInput
          value={userInput}
          onChangeText={setUserInput}
          placeholder="Type the missing word..."
          placeholderTextColor="#999"
          autoFocus
          style={{
            borderWidth: 2,
            borderColor: '#D1D5DB',
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: 18,
            fontWeight: '600',
            textAlign: 'center',
            color: '#111',
            marginBottom: 16,
          }}
          accessibilityLabel="Missing word"
        />
      )}

      {/* Hint */}
      {exercise.hintText && !isRevealed && (
        <Text style={{ fontSize: 14, color: '#999', fontStyle: 'italic', marginBottom: 16 }}>
          Hint: {exercise.hintText}
        </Text>
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
            backgroundColor: userInput.trim().length > 0 ? '#6366F1' : '#C7D2FE',
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Check answer"
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Check</Text>
        </Pressable>
      )}
    </View>
  );
}
