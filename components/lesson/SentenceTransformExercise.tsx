import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { haptic } from '../../lib/haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { HighlightedText } from '../shared/HighlightedText';
import { Button } from '../ui/Button';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import { isRestored, regradePick } from '../../lib/exercise-restore';
import type { Exercise, LanguageCode } from '../../types';

interface SentenceTransformExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  /** Previously recorded answer, restored by the runner on Previous. */
  selected?: string | null;
  userId?: string;
  language?: string;
  cefrLevel?: string;
}

export function SentenceTransformExercise({
  exercise,
  onAnswer,
  showResult,
  selected = null,
  userId,
  language,
  cefrLevel,
}: SentenceTransformExerciseProps) {
  // Seeded from the recorded pick so Previous comes back to the answer the
  // learner actually gave, in its graded state — see lib/exercise-restore.ts.
  const [answer, setAnswer] = useState(selected ?? '');
  const [submitted, setSubmitted] = useState(() => isRestored(selected));
  const [result, setResult] = useState<GradeResult | null>(() =>
    regradePick(exercise, selected),
  );

  const originalSentence = (exercise.metadata?.originalSentence as string) ?? exercise.prompt;
  const instruction = (exercise.metadata?.instruction as string) ?? '';
  const highlight = exercise.targetGrammar ?? exercise.targetWord;

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

  return (
    <ExerciseCard type={exercise.type} prompt="Transform the sentence">
      {/* Original sentence */}
      <View className="mb-3 p-3 rounded-[14px] bg-dark-card-alt">
        <Text className="text-text-secondary text-xs font-medium mb-1">Original sentence</Text>
        <HighlightedText
          text={originalSentence}
          highlight={highlight}
          className="text-text-primary text-lg leading-7"
        />
      </View>

      {/* Transformation instruction */}
      {instruction ? (
        <View className="mb-4 p-3 rounded-[14px] bg-primary/10">
          <Text className="text-primary text-sm font-semibold">{instruction}</Text>
        </View>
      ) : null}

      <TextInput
        className={`border-2 ${getBorderClass()} rounded-[14px] px-4 py-2.5 text-base text-text-primary`}
        placeholder="Type the transformed sentence..."
        placeholderTextColor="#64748B"
        value={answer}
        onChangeText={setAnswer}
        editable={!submitted && !showResult}
        autoCapitalize="none"
        accessibilityLabel="Sentence transformation input"
        accessibilityHint="Type the transformed sentence"
      />

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
