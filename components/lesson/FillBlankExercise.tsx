import { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { ExerciseHint } from './ExerciseHint';
import { HighlightedText } from '../shared/HighlightedText';
import { typedLanguageFor } from '../../lib/script-input';
import { ScriptInput } from '../shared/ScriptInput';
import { SlabButton } from '../ui2/SlabButton';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import { blankContext, exerciseHints, isRestored, regradePick } from '../../lib/exercise-restore';
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
  /**
   * Every other key this lesson and unit teach. A candidate that is one of
   * them is another question's answer, never a typo of this one.
   */
  siblingKeys?: readonly string[];
}

export function FillBlankExercise({
  exercise,
  onAnswer,
  showResult,
  selected = null,
  userId,
  language,
  cefrLevel,
  siblingKeys,
}: FillBlankExerciseProps) {
  const { c } = useUi2Theme();
  // Seeded from the recorded pick so Previous comes back to the answer the
  // learner actually gave, in its graded state — see lib/exercise-restore.ts.
  const [answer, setAnswer] = useState(selected ?? '');
  const [submitted, setSubmitted] = useState(() => isRestored(selected));
  const [result, setResult] = useState<GradeResult | null>(() =>
    regradePick(exercise, selected, language as LanguageCode | undefined, siblingKeys),
  );

  // Split prompt on "___" to show sentence with blank
  const parts = exercise.prompt.split('___');

  const handleSubmit = () => {
    if (!answer.trim() || submitted) return;

    const grade = gradeAnswer(answer, exercise.correctAnswer, exercise.acceptedAnswers, {
      exerciseHints: exerciseHints(exercise, language as LanguageCode | undefined, siblingKeys),
    });
    setResult(grade);
    setSubmitted(true);

    haptic(grade.isCorrect ? 'correct' : 'incorrect');

    onAnswer(grade.isCorrect, answer);
  };


  const getBorderColor = () => {
    if (!submitted) return c.cardBorder;
    if (result?.isCorrect) return c.green;
    return c.error;
  };

  const highlight = exercise.targetWord ?? exercise.targetGrammar;
  /** Lets the input bar offer the missing PIECE of the word, not the word. */
  const blank = useMemo(
    () => (exercise.type === 'fill_blank' ? blankContext(exercise.prompt) : undefined),
    [exercise.type, exercise.prompt],
  );

  /** Ranks the candidate bar toward what this row teaches; never adds to it. */
  const scriptContext = useMemo(
    () => [exercise.correctAnswer, ...(exercise.acceptedAnswers ?? [])],
    [exercise.correctAnswer, exercise.acceptedAnswers],
  );


  return (
    <ExerciseCard type={exercise.type} prompt="Fill in the blank"
      exercise={exercise}
      language={language}
      userId={userId}
      answered={submitted || showResult}
    >
      <View className="mb-4">
        {parts.length > 1 ? (
          <Text className="text-lg leading-7" style={{ color: c.ink }}>
            <HighlightedText text={parts[0] ?? ''} highlight={highlight} />
            <Text className="font-bold" style={{ color: c.primary }}> _____ </Text>
            <HighlightedText text={parts[1] ?? ''} highlight={highlight} />
          </Text>
        ) : (
          <HighlightedText
            text={exercise.prompt}
            highlight={highlight}
            className="text-lg leading-7"
            style={{ color: c.ink }}
          />
        )}
      </View>

      <ExerciseHint hint={exercise.hintText} revealed={submitted || showResult} />

      {/* Deliberately NOT Ui2Input: this field's outline is graded feedback
          (neutral / green / red) and Ui2Input only models neutral, focus and
          error. Swapping it in would silently drop the "you got it" state. */}
      <ScriptInput
        language={typedLanguageFor(exercise.type, language as LanguageCode | undefined)}
        context={scriptContext}
        trim={blank}
        className="border-2 rounded-[14px] px-4 py-2.5 text-base"
        style={{ borderColor: getBorderColor(), color: c.ink }}
        placeholder="Type the missing word..."
        placeholderTextColor={c.idle}
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
            color={result.isCorrect ? c.green : c.error}
          />
          <Text className="ml-1 text-sm font-semibold" style={{ color: c.ink }}>
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
          <SlabButton
            label="Check"
            onPress={handleSubmit}
            disabled={!answer.trim()}
          />
        </View>
      )}
    </ExerciseCard>
  );
}
