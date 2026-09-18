import { useState, useRef, useMemo } from 'react';
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
import { exerciseHints, isRestored, regradePick } from '../../lib/exercise-restore';
import {
  gradeOpenResponse,
  fallbackNote,
  restoreOpenGrade,
  type OpenGradeResult,
} from '../../lib/semantic-grading';
import type { Exercise, LanguageCode } from '../../types';

interface TranslationExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  /** Previously recorded answer, restored by the runner on Previous. */
  selected?: string | null;
  /**
   * Whether the runner recorded the restored answer as correct. Only read for
   * `free_production`: its grade may have come from the semantic grader, which
   * the key alone cannot reproduce (see lib/semantic-grading.ts).
   */
  restoredCorrect?: boolean | null;
  userId?: string;
  language?: string;
  cefrLevel?: string;
  /**
   * Every other key this lesson and unit teach. A candidate that is one of
   * them is another question's answer, never a typo of this one.
   */
  siblingKeys?: readonly string[];
}

/** Open sentence production is the one type here whose key is illustrative. */
function isOpenProduction(exercise: Exercise): boolean {
  return exercise.type === 'free_production';
}

export function TranslationExercise({
  exercise,
  onAnswer,
  showResult,
  selected = null,
  restoredCorrect = null,
  userId,
  language,
  cefrLevel,
  siblingKeys,
}: TranslationExerciseProps) {
  const { c } = useUi2Theme();
  const lang = language as LanguageCode | undefined;
  // Seeded from the recorded pick so Previous comes back to the answer the
  // learner actually gave, in its graded state — see lib/exercise-restore.ts.
  const [answer, setAnswer] = useState(selected ?? '');
  const [submitted, setSubmitted] = useState(() => isRestored(selected));
  const [result, setResult] = useState<GradeResult | null>(() => {
    const fixed = regradePick(exercise, selected, lang, siblingKeys);
    return isOpenProduction(exercise) ? restoreOpenGrade(fixed, restoredCorrect) : fixed;
  });
  const [isGrading, setIsGrading] = useState(false);
  /**
   * A ref, not the `isGrading` state: two taps dispatched in the same React
   * batch both read the pre-update value, so the state guard lets both through
   * and each spends a unit of the day's semantic allowance. Same pattern as
   * `submittingRef` on the writing screen.
   */
  const gradingRef = useRef(false);
  /** Provenance of an open-production grade, when it was not the grader's. */
  const [gradeNote, setGradeNote] = useState<string | null>(null);

  const finish = (grade: GradeResult) => {
    setResult(grade);
    setSubmitted(true);
    haptic(grade.isCorrect ? 'correct' : 'incorrect');
    onAnswer(grade.isCorrect, answer);
  };

  const handleSubmit = () => {
    if (!answer.trim() || submitted || gradingRef.current) return;
    const hints = exerciseHints(exercise, lang, siblingKeys);

    // Translations have a definite key and stay on the string grader. Open
    // production goes to the semantic grader, with the key as the fast path
    // and the honest fallback.
    if (!isOpenProduction(exercise) || !lang) {
      finish(gradeAnswer(answer, exercise.correctAnswer, exercise.acceptedAnswers, { exerciseHints: hints }));
      return;
    }

    gradingRef.current = true;
    setIsGrading(true);
    gradeOpenResponse({
      answer,
      key: exercise.correctAnswer,
      alternatives: exercise.acceptedAnswers,
      language: lang,
      level: cefrLevel ?? 'A1',
      kind: 'free_production',
      promptText: exercise.prompt,
      exerciseHints: hints,
    })
      .then((grade: OpenGradeResult) => {
        setGradeNote(grade.source === 'fixed_fallback' ? fallbackNote(grade.fallbackReason) : null);
        finish(grade);
      })
      .catch((err: unknown) => {
        // gradeOpenResponse folds remote failures into its result, so this is
        // an unexpected failure: say so and leave Check available.
        console.warn('[free-production] grading failed:', err);
        setGradeNote('Could not check that answer. Please try again.');
      })
      .finally(() => { gradingRef.current = false; setIsGrading(false); });
  };

  /** A palette token rather than the Tailwind border class it used to return,
   *  so the graded outline follows the phone's light/dark setting. */
  const getBorderColor = () => {
    if (!submitted) return c.cardBorder;
    if (result?.isCorrect) return c.green;
    return c.error;
  };

  const highlight = exercise.targetWord ?? exercise.targetGrammar;
  const promptNode = (
    <HighlightedText
      text={exercise.prompt}
      highlight={highlight}
      className="text-[22px] font-sans-semibold"
      style={{ color: c.ink }}
    />
  );
  /** Ranks the candidate bar toward what this row teaches; never adds to it. */
  const scriptContext = useMemo(
    () => [exercise.correctAnswer, ...(exercise.acceptedAnswers ?? [])],
    [exercise.correctAnswer, exercise.acceptedAnswers],
  );


  return (
    <ExerciseCard type={exercise.type} promptNode={promptNode}
      exercise={exercise}
      language={language}
      userId={userId}
      answered={submitted || showResult}
    >
      {/* Only into the target language. A translate-to-native hint glosses the
          very words being translated — see components/lesson/ExerciseHint.tsx. */}
      {exercise.type === 'translate_to_target' ? (
        <ExerciseHint hint={exercise.hintText} revealed={submitted || showResult} />
      ) : null}

      <ScriptInput

        language={typedLanguageFor(exercise.type, language as LanguageCode | undefined)}

        context={scriptContext}
        className="border-2 rounded-[14px] px-4 py-2.5 text-base min-h-[80px]"
        style={{ borderColor: getBorderColor(), color: c.ink }}
        placeholder={isOpenProduction(exercise) ? 'Write your sentence...' : 'Type your translation...'}
        placeholderTextColor={c.idle}
        value={answer}
        onChangeText={setAnswer}
        editable={!submitted && !showResult && !isGrading}
        multiline
        textAlignVertical="top"
        accessibilityLabel={isOpenProduction(exercise) ? 'Your sentence' : 'Translation input'}
        accessibilityHint={isOpenProduction(exercise) ? 'Write a sentence that answers the prompt' : 'Type your translation of the prompt'}
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
      {gradeNote ? (
        <Text className="mt-2 text-xs" style={{ color: c.muted }} accessibilityRole="alert">
          {gradeNote}
        </Text>
      ) : null}

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
            label={isGrading ? 'Checking…' : 'Check'}
            onPress={handleSubmit}
            disabled={!answer.trim() || isGrading}
            loading={isGrading}
          />
        </View>
      )}
    </ExerciseCard>
  );
}
