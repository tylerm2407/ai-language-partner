import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { HighlightedText } from '../shared/HighlightedText';
import { Button } from '../ui/Button';
import { colors } from '../../config/theme';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import { isRestored, regradePick } from '../../lib/exercise-restore';
import type { Exercise, LanguageCode } from '../../types';

interface FillBlankExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  /** Previously recorded answer, restored by the runner on Previous. */
  selected?: string | null;
  userId?: string;
  language?: string;
  cefrLevel?: string;
}

export function FillBlankExercise({
  exercise,
  onAnswer,
  showResult,
  selected = null,
  userId,
  language,
  cefrLevel,
}: FillBlankExerciseProps) {
  // Seeded from the recorded pick so Previous comes back to the answer the
  // learner actually gave, in its graded state — see lib/exercise-restore.ts.
  const [answer, setAnswer] = useState(selected ?? '');
  const [submitted, setSubmitted] = useState(() => isRestored(selected));
  const [result, setResult] = useState<GradeResult | null>(() =>
    regradePick(exercise, selected),
  );

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
        language: language as LanguageCode | undefined,
      },
    });
    setResult(grade);
    setSubmitted(true);

    haptic(grade.isCorrect ? 'correct' : 'incorrect');

    onAnswer(grade.isCorrect, answer);
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
          revealAnswer={showResult}
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
