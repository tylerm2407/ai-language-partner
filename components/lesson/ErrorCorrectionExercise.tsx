import { useState, useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { FeedbackCard } from './FeedbackCard';
import { ExerciseHint } from './ExerciseHint';
import { HighlightedText } from '../shared/HighlightedText';
import { typedLanguageFor } from '../../lib/script-input';
import { ScriptInput } from '../shared/ScriptInput';
import { Body, Caption } from '../ui2/Ui2Text';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { spacing, radii } from '../../config/theme';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import { exerciseHints, isRestored, regradePick } from '../../lib/exercise-restore';
import type { Exercise, LanguageCode } from '../../types';

interface Props {
  exercise: Exercise;
  onAnswer: (isCorrect: boolean, answer: string) => void;
  /**
   * The runner has resolved this exercise — render read-only, and let the
   * FeedbackCard reveal the answer. False while a second attempt is open.
   */
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

export function ErrorCorrectionExercise({
  exercise,
  onAnswer,
  showResult,
  selected = null,
  userId,
  language,
  cefrLevel,
  siblingKeys,
}: Props) {
  const { c } = useUi2Theme();
  // Seeded from the recorded pick so Previous comes back to the answer the
  // learner actually gave, in its graded state — see lib/exercise-restore.ts.
  const [userInput, setUserInput] = useState(selected ?? '');
  const [localRevealed, setLocalRevealed] = useState(() => isRestored(selected));
  /**
   * Locked = this exercise's own reveal, OR the runner saying it is resolved
   * (walked back onto, or out of attempts). The runner's word has to be able
   * to lock it too, or a second attempt could not be handed back.
   */
  const isRevealed = localRevealed || showResult;
  const [result, setResult] = useState<GradeResult | null>(() =>
    regradePick(exercise, selected, language as LanguageCode | undefined, siblingKeys),
  );

  const errorSentence = (exercise.metadata?.error_sentence as string) ?? exercise.prompt;
  // Some reviewed tasks practise a formal register or a changed reporting
  // context. Their source may be grammatical elsewhere; show the authored
  // constraint instead of falsely calling the source universally erroneous.
  const rawInstruction = exercise.metadata?.correction_instruction;
  const correctionInstruction = typeof rawInstruction === 'string' ? rawInstruction.trim() : '';
  const highlight = exercise.targetWord ?? exercise.targetGrammar;

  const handleCheck = () => {
    if (!userInput.trim() || isRevealed) return;

    const grade = gradeAnswer(userInput, exercise.correctAnswer, exercise.acceptedAnswers, {
      exerciseHints: exerciseHints(exercise, language as LanguageCode | undefined, siblingKeys),
    });
    setResult(grade);
    setLocalRevealed(true);

    haptic(grade.isCorrect ? 'correct' : 'incorrect');
    onAnswer(grade.isCorrect, userInput);
  };


  const isCorrect = result?.isCorrect ?? false;
  /** Ranks the candidate bar toward what this row teaches; never adds to it. */
  const scriptContext = useMemo(
    () => [exercise.correctAnswer, ...(exercise.acceptedAnswers ?? [])],
    [exercise.correctAnswer, exercise.acceptedAnswers],
  );


  return (
    <View style={{ flex: 1 }}>
      <Caption tone="accent" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
        {correctionInstruction ? 'Rewrite for this context' : 'Find and fix the error'}
      </Caption>

      {/* Sentence with error */}
      <View style={{
        // A row carrying an authored `correctionInstruction` is a rewrite
        // task, not an error hunt, so it does not get the error tint.
        backgroundColor: correctionInstruction ? c.card : c.pinkTint, borderRadius: radii.xxl, padding: spacing.lg, marginBottom: spacing.lg + spacing.xxs, minHeight: 100,
        justifyContent: 'center',
      }}>
        <HighlightedText
          text={errorSentence}
          highlight={highlight}
          className="text-[18px] leading-7"
          style={{ color: c.ink }}
        />
        <Caption style={{ color: c.ink, marginTop: spacing.xs, fontStyle: 'italic' }}>
          {correctionInstruction || 'This sentence contains an error. Type the corrected version below.'}
        </Caption>
      </View>

      <ExerciseHint hint={exercise.hintText} revealed={isRevealed} />

      {/* Corrected Input */}
      <View>
        <ScriptInput
          language={typedLanguageFor(exercise.type, language as LanguageCode | undefined)}
          context={scriptContext}
          value={userInput}
          onChangeText={setUserInput}
          placeholder={correctionInstruction ? 'Type the rewritten sentence...' : 'Type the corrected sentence...'}
          placeholderTextColor={c.idle}
          editable={!isRevealed}
          multiline
          style={{
            borderWidth: 2,
            borderColor: isRevealed ? (isCorrect ? c.green : c.error) : c.cardBorder,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            fontSize: 16,
            minHeight: 80,
            textAlignVertical: 'top',
            color: c.ink,
            marginBottom: spacing.md,
          }}
          accessibilityLabel={correctionInstruction ? 'Rewritten sentence' : 'Corrected sentence'}
        />
        {isRevealed && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <Ionicons
              name={isCorrect ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={isCorrect ? c.green : c.error}
              style={{ marginRight: spacing.xxs }}
            />
            <Caption style={{ color: c.ink }}>
              {isCorrect ? 'Correct' : 'Incorrect'}
            </Caption>
          </View>
        )}
      </View>

      {/* Differentiated feedback */}
      {result && isRevealed && language ? (
        <FeedbackCard
          result={result}
          exercise={exercise}
          language={language}
          cefrLevel={cefrLevel}
          userId={userId}
          revealAnswer={showResult}
        />
      ) : null}

      {/* Button */}
      {!isRevealed && (
        <Pressable
          onPress={handleCheck}
          disabled={userInput.trim().length === 0}
          style={{
            backgroundColor: c.primary,
            opacity: userInput.trim().length > 0 ? 1 : 0.6,
            paddingVertical: spacing.md, borderRadius: radii.lg, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Check answer"
        >
          <Body size="lg" weight="semibold" tone="onPrimary">Check</Body>
        </Pressable>
      )}
    </View>
  );
}
