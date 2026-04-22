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
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#6366F1', marginBottom: 8 }}>
        Find and fix the error
      </Text>

      {/* Sentence with error */}
      <View style={{
        backgroundColor: '#FEE2E2', borderRadius: 20, padding: 24, marginBottom: 20, minHeight: 100,
        justifyContent: 'center',
      }}>
        <HighlightedText
          text={errorSentence}
          highlight={highlight}
          className="text-[#111] text-[18px] leading-7"
        />
        <Text style={{ fontSize: 13, color: '#EF4444', marginTop: 8, fontStyle: 'italic' }}>
          This sentence contains an error. Type the corrected version below.
        </Text>
      </View>

      {/* Corrected Input */}
      <TextInput
        value={userInput}
        onChangeText={setUserInput}
        placeholder="Type the corrected sentence..."
        placeholderTextColor="#999"
        editable={!isRevealed}
        multiline
        style={{
          borderWidth: 2,
          borderColor: isRevealed ? (isCorrect ? '#22C55E' : '#EF4444') : '#D1D5DB',
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 10,
          fontSize: 16,
          minHeight: 80,
          textAlignVertical: 'top',
          color: '#111',
          marginBottom: 16,
        }}
        accessibilityLabel="Corrected sentence"
      />

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
            backgroundColor: userInput.trim().length > 0 ? '#6366F1' : '#C7D2FE',
            paddingVertical: 16, borderRadius: 14, alignItems: 'center',
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
