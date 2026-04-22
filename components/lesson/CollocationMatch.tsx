import { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { Button } from '../ui/Button';
import type { GradeResult } from '../../lib/grading';
import type { Exercise } from '../../types';

interface CollocationMatchProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  userId?: string;
  language?: string;
  cefrLevel?: string;
  onContinue?: () => void;
}

export function CollocationMatch({
  exercise,
  onAnswer,
  showResult,
  userId,
  language,
  cefrLevel,
  onContinue,
}: CollocationMatchProps) {
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);

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

    const isCorrect = allCorrectSelected && noWrongSelected;
    const joined = selectedArr.join(', ');

    // Synthesize a GradeResult so FeedbackCard can branch. Lexical error
    // type: wrong collocation is a vocabulary miss (target word is known).
    const grade: GradeResult = {
      isCorrect,
      accuracy: isCorrect ? 1 : 0,
      feedback: isCorrect
        ? 'Correct!'
        : `Incorrect. The correct collocations are: ${collocations.join(', ')}`,
      normalizedUserAnswer: joined,
      normalizedCorrectAnswer: collocations.join(', '),
      errorType: isCorrect ? null : 'lexical',
    };
    setResult(grade);
    setSubmitted(true);

    if (Platform.OS !== 'web') {
      if (isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    onAnswer(isCorrect, joined);
  };

  const handleRetry = () => {
    setSelectedWords(new Set());
    setSubmitted(false);
    setResult(null);
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

      {result && onContinue && language ? (
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
