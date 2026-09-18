import { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
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
import { exerciseHints, isRestored, regradePick } from '../../lib/exercise-restore';
import type { Exercise, LanguageCode } from '../../types';

interface WordFormExerciseProps {
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

export function WordFormExercise({
  exercise,
  onAnswer,
  showResult,
  selected = null,
  userId,
  language,
  cefrLevel,
  siblingKeys,
}: WordFormExerciseProps) {
  const { c } = useUi2Theme();
  // Seeded from the recorded pick so Previous comes back to the answer the
  // learner actually gave, in its graded state — see lib/exercise-restore.ts.
  const [answer, setAnswer] = useState(selected ?? '');
  const [submitted, setSubmitted] = useState(() => isRestored(selected));
  const [result, setResult] = useState<GradeResult | null>(() =>
    regradePick(exercise, selected, language as LanguageCode | undefined, siblingKeys),
  );

  const baseWord = (exercise.metadata?.baseWord as string) ?? '';
  const wordFamily = (exercise.metadata?.wordFamily as string[]) ?? [];

  // Split prompt on "___" to show sentence with blank
  const parts = exercise.prompt.split('___');
  const highlight = exercise.targetWord ?? exercise.targetGrammar ?? baseWord;

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


  /** A palette token rather than the Tailwind border class it used to return,
   *  so the graded outline follows the phone's light/dark setting. */
  const getBorderColor = () => {
    if (!submitted) return c.cardBorder;
    if (result?.isCorrect) return c.green;
    return c.error;
  };
  /** Ranks the candidate bar toward what this row teaches; never adds to it. */
  const scriptContext = useMemo(
    () => [exercise.correctAnswer, ...(exercise.acceptedAnswers ?? [])],
    [exercise.correctAnswer, exercise.acceptedAnswers],
  );


  return (
    <ExerciseCard type={exercise.type} prompt="Complete the word form"
      exercise={exercise}
      language={language}
      userId={userId}
      answered={submitted || showResult}
    >
      {/* Word family hint */}
      {(baseWord || wordFamily.length > 0) && (
        <View className="mb-4 p-3 rounded-[14px]" style={{ backgroundColor: c.surface2 }}>
          {baseWord ? (
            <Text className="text-sm" style={{ color: c.muted }}>
              Base word: <Text className="font-bold" style={{ color: c.primary }}>{baseWord}</Text>
            </Text>
          ) : null}
          {wordFamily.length > 0 && (
            <Text className="text-sm mt-1" style={{ color: c.muted }}>
              Word family: {wordFamily.join(', ')}
            </Text>
          )}
        </View>
      )}

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

      <ScriptInput

        language={typedLanguageFor(exercise.type, language as LanguageCode | undefined)}

        context={scriptContext}
        className="border-2 rounded-[14px] px-4 py-2.5 text-base"
        style={{ borderColor: getBorderColor(), color: c.ink }}
        placeholder="Type the correct word form..."
        placeholderTextColor={c.idle}
        value={answer}
        onChangeText={setAnswer}
        editable={!submitted && !showResult}
        autoCapitalize="none"
        accessibilityLabel="Word form input"
        accessibilityHint="Type the correct form of the word"
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
