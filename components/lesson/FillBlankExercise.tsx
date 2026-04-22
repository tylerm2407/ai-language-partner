import { useState } from 'react';
import { View, Text, TextInput, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { HighlightedText } from '../shared/HighlightedText';
import { Button } from '../ui/Button';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import type { Exercise } from '../../types';

interface FillBlankExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  userId?: string;
  language?: string;
  cefrLevel?: string;
  onContinue?: () => void;
}

export function FillBlankExercise({
  exercise,
  onAnswer,
  showResult,
  userId,
  language,
  cefrLevel,
  onContinue,
}: FillBlankExerciseProps) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);

  // Split prompt on "___" to show sentence with blank
  const parts = exercise.prompt.split('___');

  const handleSubmit = () => {
    if (!answer.trim() || submitted) return;

    const grade = gradeAnswer(answer, exercise.correctAnswer, exercise.acceptedAnswers, {
      exerciseHints: {
        exerciseType: exercise.type,
        skillType: exercise.skillType,
        targetGrammar: exercise.targetGrammar,
        targetWord: exercise.targetWord,
      },
    });
    setResult(grade);
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

  const handleRetry = () => {
    setAnswer('');
    setSubmitted(false);
    setResult(null);
  };

  const getBorderClass = () => {
    if (!submitted) return 'border-input-border';
    if (result?.isCorrect) return 'border-success';
    return 'border-error';
  };

  const highlight = exercise.targetWord ?? exercise.targetGrammar;

  return (
    <ExerciseCard type={exercise.type} prompt="Fill in the blank">
      <View className="mb-4">
        {parts.length > 1 ? (
          <Text className="text-text-primary text-lg leading-7">
            <HighlightedText text={parts[0] ?? ''} highlight={highlight} />
            <Text className="text-primary font-bold"> _____ </Text>
            <HighlightedText text={parts[1] ?? ''} highlight={highlight} />
          </Text>
        ) : (
          <HighlightedText
            text={exercise.prompt}
            highlight={highlight}
            className="text-text-primary text-lg leading-7"
          />
        )}
      </View>

      <TextInput
        className={`border-2 ${getBorderClass()} rounded-[14px] px-4 py-2.5 text-base text-text-primary`}
        placeholder="Type the missing word..."
        placeholderTextColor="#64748B"
        value={answer}
        onChangeText={setAnswer}
        editable={!submitted && !showResult}
        autoCapitalize="none"
        accessibilityLabel="Fill in the blank input"
        accessibilityHint="Type the missing word"
      />

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
            disabled={!answer.trim()}
          />
        </View>
      )}
    </ExerciseCard>
  );
}
