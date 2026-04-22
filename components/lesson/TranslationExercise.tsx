import { useState, useRef } from 'react';
import { View, TextInput, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { HighlightedText } from '../shared/HighlightedText';
import { Button } from '../ui/Button';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import type { Exercise } from '../../types';

interface TranslationExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  userId?: string;
  language?: string;
  cefrLevel?: string;
  onContinue?: () => void;
}

export function TranslationExercise({
  exercise,
  onAnswer,
  showResult,
  userId,
  language,
  cefrLevel,
  onContinue,
}: TranslationExerciseProps) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const startTime = useRef(Date.now());

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
    startTime.current = Date.now();
  };

  const getBorderClass = () => {
    if (!submitted) return 'border-input-border';
    if (result?.isCorrect) return 'border-success';
    return 'border-error';
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
