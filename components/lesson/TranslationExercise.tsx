import { useState, useRef } from 'react';
import { View, Text, TextInput, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { Button } from '../ui/Button';
import { gradeAnswer } from '../../lib/grading';
import type { Exercise } from '../../types';

interface TranslationExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
}

export function TranslationExercise({ exercise, onAnswer, showResult }: TranslationExerciseProps) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; feedback: string } | null>(null);
  const startTime = useRef(Date.now());

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
    <ExerciseCard type={exercise.type} prompt={exercise.prompt}>
      <TextInput
        className={`border-2 ${getBorderClass()} rounded-[14px] px-4 py-2.5 text-base text-text-primary min-h-[80px]`}
        placeholder="Type your translation..."
        placeholderTextColor="#64748B"
        value={answer}
        onChangeText={setAnswer}
        editable={!submitted && !showResult}
        multiline
        textAlignVertical="top"
        accessibilityLabel="Translation input"
        accessibilityHint="Type your translation of the prompt"
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
