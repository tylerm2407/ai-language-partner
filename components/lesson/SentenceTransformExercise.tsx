import { useState } from 'react';
import { View, Text, TextInput, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { Button } from '../ui/Button';
import { gradeAnswer } from '../../lib/grading';
import type { Exercise } from '../../types';

interface SentenceTransformExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
}

export function SentenceTransformExercise({ exercise, onAnswer, showResult }: SentenceTransformExerciseProps) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; feedback: string } | null>(null);

  const originalSentence = (exercise.metadata?.originalSentence as string) ?? exercise.prompt;
  const instruction = (exercise.metadata?.instruction as string) ?? '';

  const handleSubmit = () => {
    if (!answer.trim() || submitted) return;

    const grade = gradeAnswer(answer, exercise.correctAnswer, exercise.acceptedAnswers);
    setResult({ isCorrect: grade.isCorrect, feedback: grade.feedback });
    setSubmitted(true);

    if (Platform.OS !== 'web') {
      if (grade.isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    onAnswer(grade.isCorrect, answer);
  };

  const getBorderClass = () => {
    if (!submitted) return 'border-input-border';
    if (result?.isCorrect) return 'border-success';
    return 'border-error';
  };

  return (
    <ExerciseCard type={exercise.type} prompt="Transform the sentence">
      {/* Original sentence */}
      <View className="mb-3 p-3 rounded-[14px] bg-dark-card-alt">
        <Text className="text-text-secondary text-xs font-medium mb-1">Original sentence</Text>
        <Text className="text-text-primary text-lg leading-7">{originalSentence}</Text>
      </View>

      {/* Transformation instruction */}
      {instruction ? (
        <View className="mb-4 p-3 rounded-[14px] bg-primary/10">
          <Text className="text-primary text-sm font-semibold">{instruction}</Text>
        </View>
      ) : null}

      <TextInput
        className={`border-2 ${getBorderClass()} rounded-[14px] px-4 py-2.5 text-base text-text-primary`}
        placeholder="Type the transformed sentence..."
        placeholderTextColor="#64748B"
        value={answer}
        onChangeText={setAnswer}
        editable={!submitted && !showResult}
        autoCapitalize="none"
        accessibilityLabel="Sentence transformation input"
        accessibilityHint="Type the transformed sentence"
      />

      {(submitted || showResult) && result && (
        <View className={`mt-3 p-3 rounded-[14px] ${result.isCorrect ? 'bg-success-bg' : 'bg-error-bg'}`}>
          <Text className={`text-sm font-medium ${result.isCorrect ? 'text-success' : 'text-error'}`}>
            {result.feedback}
          </Text>
        </View>
      )}

      {!submitted && !showResult && (
        <View className="mt-4">
          <Button
            label="Check"
            onPress={handleSubmit}
            disabled={!answer.trim()}
          />
        </View>
      )}
    </ExerciseCard>
  );
}
