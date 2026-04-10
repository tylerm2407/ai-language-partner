import { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { Button } from '../ui/Button';
import type { Exercise } from '../../types';

interface CollocationMatchProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
}

export function CollocationMatch({ exercise, onAnswer, showResult }: CollocationMatchProps) {
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const collocations: string[] = (exercise.metadata?.collocations as string[]) ?? [];
  const distractors: string[] = exercise.distractors ?? [];
  const allOptions = [...collocations, ...distractors];
  const targetWord = exercise.targetWord ?? exercise.prompt;

  const handleToggle = (word: string) => {
    if (submitted || showResult) return;

    setSelectedWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        next.add(word);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (submitted || selectedWords.size === 0) return;

    const selectedArr = Array.from(selectedWords);
    const correctSet = new Set(collocations.map((c) => c.toLowerCase()));

    const allCorrectSelected = collocations.every((c) =>
      selectedArr.map((s) => s.toLowerCase()).includes(c.toLowerCase())
    );
    const noWrongSelected = selectedArr.every((s) =>
      correctSet.has(s.toLowerCase())
    );

    const correct = allCorrectSelected && noWrongSelected;
    setIsCorrect(correct);
    setSubmitted(true);

    if (Platform.OS !== 'web') {
      if (correct) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    onAnswer(correct, selectedArr.join(', '));
  };

  const getOptionStyle = (word: string) => {
    const isSelected = selectedWords.has(word);
    const isCollocation = collocations.map((c) => c.toLowerCase()).includes(word.toLowerCase());

    if (!submitted && !showResult) {
      return isSelected
        ? 'bg-primary/20 border-2 border-primary'
        : 'bg-dark-card-alt border-2 border-transparent';
    }

    // After submission: highlight correct/incorrect
    if (isCollocation) {
      return 'bg-success-bg border-2 border-success';
    }
    if (isSelected && !isCollocation) {
      return 'bg-error-bg border-2 border-error';
    }
    return 'bg-dark-card-alt border-2 border-transparent';
  };

  return (
    <ExerciseCard type={exercise.type} prompt={exercise.prompt}>
      <View className="mb-4 items-center">
        <Text className="text-primary text-2xl font-bold">{targetWord}</Text>
        <Text className="text-text-secondary text-sm mt-1">
          Select all words that collocate with this word
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2 mb-4">
        {allOptions.map((word, index) => (
          <Pressable
            key={index}
            className={`px-4 py-2.5 rounded-[14px] ${getOptionStyle(word)}`}
            onPress={() => handleToggle(word)}
            disabled={submitted || showResult}
            accessibilityRole="button"
            accessibilityLabel={`Option: ${word}`}
            accessibilityState={{
              selected: selectedWords.has(word),
              disabled: submitted || showResult,
            }}
          >
            <Text className="text-text-primary text-[15px] font-semibold">
              {word}
            </Text>
          </Pressable>
        ))}
      </View>

      {(submitted || showResult) && (
        <View className={`mt-3 p-3 rounded-[14px] ${isCorrect ? 'bg-success-bg' : 'bg-error-bg'}`}>
          <Text className={`text-sm font-medium ${isCorrect ? 'text-success' : 'text-error'}`}>
            {isCorrect
              ? 'Correct!'
              : `Incorrect. The correct collocations are: ${collocations.join(', ')}`}
          </Text>
        </View>
      )}

      {!submitted && !showResult && (
        <View className="mt-4">
          <Button
            label="Check"
            onPress={handleSubmit}
            disabled={selectedWords.size === 0}
          />
        </View>
      )}
    </ExerciseCard>
  );
}
