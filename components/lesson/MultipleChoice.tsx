import { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { HighlightedText } from '../shared/HighlightedText';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import type { Exercise } from '../../types';

interface MultipleChoiceProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  userId?: string;
  language?: string;
  cefrLevel?: string;
  onContinue?: () => void;
}

export function MultipleChoice({
  exercise,
  onAnswer,
  showResult,
  userId,
  language,
  cefrLevel,
  onContinue,
}: MultipleChoiceProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const options = exercise.options ?? [];

  const handleSelect = (option: string) => {
    if (showResult || selected !== null) return;
    setSelected(option);

    // Use gradeAnswer so we get the classified errorType for FeedbackCard.
    const grade = gradeAnswer(
      option,
      exercise.correctAnswer,
      exercise.acceptedAnswers,
      {
        exerciseHints: {
          exerciseType: exercise.type,
          skillType: exercise.skillType,
          targetGrammar: exercise.targetGrammar,
          targetWord: exercise.targetWord,
        },
      },
    );
    setResult(grade);

    if (Platform.OS !== 'web') {
      if (grade.isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    onAnswer(grade.isCorrect, option);
  };

  const handleRetry = () => {
    setSelected(null);
    setResult(null);
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

  const highlight = exercise.targetWord ?? exercise.targetGrammar;
  const promptNode = (
    <HighlightedText
      text={exercise.prompt}
      highlight={highlight}
      className="text-text-primary text-[22px] font-sans-semibold"
    />
  );

  return (
    <ExerciseCard type={exercise.type} promptNode={promptNode}>
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
    </ExerciseCard>
  );
}
