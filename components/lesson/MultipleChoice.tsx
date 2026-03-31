import { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import type { Exercise } from '../../types';

interface MultipleChoiceProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
}

export function MultipleChoice({ exercise, onAnswer, showResult }: MultipleChoiceProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const options = exercise.options ?? [];

  const handleSelect = (option: string) => {
    if (showResult || selected !== null) return;
    setSelected(option);

    const isCorrect =
      option.toLowerCase() === exercise.correctAnswer.toLowerCase() ||
      exercise.acceptedAnswers.map((a) => a.toLowerCase()).includes(option.toLowerCase());

    if (Platform.OS !== 'web') {
      if (isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    onAnswer(isCorrect, option);
  };

  const getOptionStyle = (option: string) => {
    if (!selected && !showResult) {
      return 'bg-dark-card-alt border-2 border-transparent';
    }
    const isThis = option === selected;
    const isCorrectOption =
      option.toLowerCase() === exercise.correctAnswer.toLowerCase() ||
      exercise.acceptedAnswers.map((a) => a.toLowerCase()).includes(option.toLowerCase());

    if (showResult && isCorrectOption) {
      return 'bg-success-bg border-2 border-success';
    }
    if (isThis && !isCorrectOption) {
      return 'bg-error-bg border-2 border-error';
    }
    if (isThis && isCorrectOption) {
      return 'bg-success-bg border-2 border-success';
    }
    return 'bg-dark-card-alt border-2 border-transparent';
  };

  return (
    <ExerciseCard type={exercise.type} prompt={exercise.prompt}>
      <View>
        {options.map((option, index) => (
          <Pressable
            key={index}
            className={`p-4 rounded-[14px] mb-2.5 ${getOptionStyle(option)}`}
            onPress={() => handleSelect(option)}
            disabled={selected !== null || showResult}
            accessibilityRole="button"
            accessibilityLabel={`Option ${index + 1}: ${option}`}
            accessibilityState={{
              selected: option === selected,
              disabled: selected !== null || showResult,
            }}
          >
            <Text className="text-text-primary text-[17px] font-semibold">
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </ExerciseCard>
  );
}
