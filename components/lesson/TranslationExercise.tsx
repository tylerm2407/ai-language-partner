import { useState, useRef } from 'react';
import { View, Text, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { HighlightedText } from '../shared/HighlightedText';
import { Button } from '../ui/Button';
import { colors } from '../../config/theme';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import { isRestored, regradePick } from '../../lib/exercise-restore';
import type { Exercise } from '../../types';

interface TranslationExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  /** Previously recorded answer, restored by the runner on Previous. */
  selected?: string | null;
  userId?: string;
  language?: string;
  cefrLevel?: string;
}

export function TranslationExercise({
  exercise,
  onAnswer,
  showResult,
  selected = null,
  userId,
  language,
  cefrLevel,
}: TranslationExerciseProps) {
  // Seeded from the recorded pick so Previous comes back to the answer the
  // learner actually gave, in its graded state — see lib/exercise-restore.ts.
  const [answer, setAnswer] = useState(selected ?? '');
  const [submitted, setSubmitted] = useState(() => isRestored(selected));
  const [result, setResult] = useState<GradeResult | null>(() =>
    regradePick(exercise, selected),
  );
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
      {submitted && result && (
        <View className="flex-row items-center mt-2">
          <Ionicons
            name={result.isCorrect ? 'checkmark-circle' : 'close-circle'}
            size={20}
            color={result.isCorrect ? colors.success.base : colors.error.base}
          />
          <Text className={`ml-1 text-sm font-semibold ${result.isCorrect ? 'text-success' : 'text-error'}`}>
            {result.isCorrect ? 'Correct' : 'Incorrect'}
          </Text>
        </View>
      )}

      {result && language ? (
        <FeedbackCard
          result={result}
          exercise={exercise}
          language={language}
          cefrLevel={cefrLevel}
          userId={userId}
          onRetry={handleRetry}
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
