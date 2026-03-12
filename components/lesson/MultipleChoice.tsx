import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Exercise } from '../../types';

interface MultipleChoiceProps {
  exercise: Exercise;
  onAnswer: (answer: string, isCorrect: boolean) => void;
}

export function MultipleChoice({ exercise, onAnswer }: MultipleChoiceProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const options = exercise.options ?? [];
  const correctAnswer = exercise.correctAnswer;

  const handleSelect = async (option: string) => {
    if (revealed) return;

    setSelected(option);
    setRevealed(true);

    const isCorrect =
      option.toLowerCase().trim() === correctAnswer.toLowerCase().trim() ||
      exercise.acceptedAnswers.some(
        (a) => a.toLowerCase().trim() === option.toLowerCase().trim()
      );

    if (isCorrect) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    // Brief delay to show result before advancing
    setTimeout(() => {
      onAnswer(option, isCorrect);
    }, 1200);
  };

  const getOptionStyle = (option: string) => {
    if (!revealed) {
      return {
        backgroundColor: selected === option ? '#E0E7FF' : '#F3F4F6',
        borderColor: selected === option ? '#6366F1' : 'transparent',
      };
    }

    const isCorrectOption = option.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    const isSelectedOption = option === selected;

    if (isCorrectOption) {
      return { backgroundColor: '#DCFCE7', borderColor: '#22C55E' };
    }
    if (isSelectedOption && !isCorrectOption) {
      return { backgroundColor: '#FEE2E2', borderColor: '#EF4444' };
    }
    return { backgroundColor: '#F3F4F6', borderColor: 'transparent' };
  };

  return (
    <View>
      <Text style={{ fontSize: 14, color: '#6366F1', fontWeight: '600', marginBottom: 8 }}>
        Choose the correct answer
      </Text>
      <Text style={{ fontSize: 22, fontWeight: '600', marginBottom: 24 }}>
        {exercise.prompt}
      </Text>

      {options.map((option, index) => {
        const optionStyle = getOptionStyle(option);
        return (
          <Pressable
            key={`${option}-${index}`}
            onPress={() => handleSelect(option)}
            disabled={revealed}
            style={{
              padding: 16,
              borderRadius: 14,
              marginBottom: 10,
              borderWidth: 2,
              ...optionStyle,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Option: ${option}`}
            accessibilityState={{ selected: selected === option }}
          >
            <Text style={{ fontSize: 17, fontWeight: selected === option ? '600' : '400' }}>
              {option}
            </Text>
          </Pressable>
        );
      })}

      {revealed && selected !== correctAnswer && (
        <Text style={{ fontSize: 15, color: '#22C55E', marginTop: 8, fontWeight: '500' }}>
          Correct answer: {correctAnswer}
        </Text>
      )}
    </View>
  );
}
