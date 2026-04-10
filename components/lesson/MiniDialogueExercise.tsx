import { useState } from 'react';
import { View, Text, TextInput, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { Button } from '../ui/Button';
import { gradeAnswer } from '../../lib/grading';
import type { Exercise } from '../../types';

interface DialogueLine {
  speaker: string;
  text: string;
}

interface MiniDialogueExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
}

export function MiniDialogueExercise({ exercise, onAnswer, showResult }: MiniDialogueExerciseProps) {
  const dialogue = (exercise.metadata?.dialogue as DialogueLine[]) ?? [];
  const blankIndices = (exercise.metadata?.blankIndices as number[]) ?? [];

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; feedback: string } | null>(null);

  // correctAnswer may contain pipe-separated answers for multiple blanks
  const correctAnswers = exercise.correctAnswer.split('|').map((a) => a.trim());
  const acceptedPerBlank: string[][] = blankIndices.map((_, i) => {
    // Each blank's accepted answers: if acceptedAnswers has pipe-separated groups, split them
    // Otherwise fall back to the full acceptedAnswers list for a single blank
    if (blankIndices.length === 1) {
      return exercise.acceptedAnswers;
    }
    // For multiple blanks, try to find matching accepted answers by index
    return exercise.acceptedAnswers
      .map((a) => {
        const parts = a.split('|');
        return parts[i]?.trim();
      })
      .filter((a): a is string => !!a);
  });

  const handleChangeAnswer = (blankIdx: number, text: string) => {
    setAnswers((prev) => ({ ...prev, [blankIdx]: text }));
  };

  const allFilled = blankIndices.every((idx) => (answers[idx] ?? '').trim().length > 0);

  const handleSubmit = () => {
    if (!allFilled || submitted) return;

    // Grade each blank
    let allCorrect = true;
    const feedbackParts: string[] = [];

    blankIndices.forEach((blankIdx, i) => {
      const userAnswer = answers[blankIdx] ?? '';
      const correct = correctAnswers[i] ?? '';
      const accepted = acceptedPerBlank[i] ?? [];

      const grade = gradeAnswer(userAnswer, correct, accepted);
      if (!grade.isCorrect) {
        allCorrect = false;
        feedbackParts.push(grade.feedback);
      }
    });

    const feedback = allCorrect
      ? 'Correct!'
      : feedbackParts.length > 0
        ? feedbackParts[0]
        : `Incorrect. The correct answer is: ${exercise.correctAnswer}`;

    setResult({ isCorrect: allCorrect, feedback });
    setSubmitted(true);

    if (Platform.OS !== 'web') {
      if (allCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    const combinedAnswer = blankIndices.map((idx) => answers[idx] ?? '').join(' | ');
    onAnswer(allCorrect, combinedAnswer);
  };

  const getBorderClass = (blankIndex: number) => {
    if (!submitted) return 'border-input-border';

    const i = blankIndices.indexOf(blankIndex);
    const userAnswer = answers[blankIndex] ?? '';
    const correct = correctAnswers[i] ?? '';
    const accepted = acceptedPerBlank[i] ?? [];
    const grade = gradeAnswer(userAnswer, correct, accepted);

    return grade.isCorrect ? 'border-success' : 'border-error';
  };

  return (
    <ExerciseCard type={exercise.type} prompt={exercise.prompt}>
      <View className="mb-4">
        {dialogue.map((line, index) => {
          const isBlank = blankIndices.includes(index);
          const isEven = index % 2 === 0;

          return (
            <View
              key={index}
              className={`mb-2.5 flex-row ${isEven ? 'justify-start' : 'justify-end'}`}
            >
              <View
                className={`max-w-[80%] p-3 rounded-[14px] ${
                  isEven ? 'bg-dark-card-alt rounded-tl-sm' : 'bg-primary/15 rounded-tr-sm'
                }`}
              >
                <Text className="text-text-secondary text-xs font-medium mb-1">
                  {line.speaker}
                </Text>
                {isBlank ? (
                  <TextInput
                    className={`border-2 ${getBorderClass(index)} rounded-[10px] px-3 py-2 text-base text-text-primary min-w-[150px]`}
                    placeholder="Type your line..."
                    placeholderTextColor="#64748B"
                    value={answers[index] ?? ''}
                    onChangeText={(text) => handleChangeAnswer(index, text)}
                    editable={!submitted && !showResult}
                    autoCapitalize="none"
                    accessibilityLabel={`Dialogue line ${index + 1} input for ${line.speaker}`}
                    accessibilityHint="Type the missing dialogue line"
                  />
                ) : (
                  <Text className="text-text-primary text-[15px] leading-6">
                    {line.text}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

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
            disabled={!allFilled}
          />
        </View>
      )}
    </ExerciseCard>
  );
}
