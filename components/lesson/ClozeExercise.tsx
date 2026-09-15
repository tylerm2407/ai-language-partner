import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { FeedbackCard } from './FeedbackCard';
import { ExerciseHint } from './ExerciseHint';
import { HighlightedText } from '../shared/HighlightedText';
import { Body, Caption } from '../ui2/Ui2Text';
import { Ui2Input } from '../ui2/Ui2Input';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { spacing, radii } from '../../config/theme';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import { exerciseHints, isRestored, regradePick } from '../../lib/exercise-restore';
import { exerciseListenTarget } from '../../lib/exercise-audio';
import { ListenWordButton } from './ListenWordButton';
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

export function ClozeExercise({
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

  // The prompt contains the sentence with "___" as the blank
  const parts = exercise.prompt.split('___');
  const beforeBlank = parts[0] ?? '';
  const afterBlank = parts[1] ?? '';

  const highlight = exercise.targetWord ?? exercise.targetGrammar;

  const listen = language ? exerciseListenTarget(exercise, language) : null;

  const handleCheck = () => {
    if (!userInput.trim() || isRevealed) return;

    const grade = gradeAnswer(userInput, exercise.correctAnswer, exercise.acceptedAnswers, {
      exerciseHints: exerciseHints(exercise, language as LanguageCode | undefined, siblingKeys),
    });
    setResult(grade);
    setLocalRevealed(true);

    haptic(grade.isCorrect ? 'correct' : 'incorrect');
    // Notify parent — this exercise historically deferred onAnswer to the
    // Continue button; updating now so LessonRunner can trigger its own
    // visual effects (sparkle / shake) without a two-step tap.
    onAnswer(grade.isCorrect, userInput);
  };


  const isCorrect = result?.isCorrect ?? false;

  return (
    <View style={{ flex: 1 }}>
      <Caption tone="accent" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
        Fill in the blank
      </Caption>

      {/* Context sentence with blank */}
      <View style={{
        backgroundColor: c.surface2, borderRadius: radii.xxl, padding: spacing.lg, marginBottom: spacing.lg + spacing.xxs, minHeight: 120,
        justifyContent: 'center',
      }}>
        <Body size="lg" style={{ lineHeight: 28 }}>
          <HighlightedText text={beforeBlank} highlight={highlight} />
          <View style={{
            borderBottomWidth: 2,
            borderBottomColor: isRevealed ? (isCorrect ? c.green : c.error) : c.primary,
            minWidth: 80,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {isRevealed && (
                <Ionicons
                  name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={isCorrect ? c.green : c.error}
                  style={{ marginRight: spacing.xxs }}
                />
              )}
              <Body size="lg" weight="semibold" style={{
                color: isRevealed ? (isCorrect ? c.green : c.error) : c.primary,
                textAlign: 'center',
                paddingHorizontal: spacing.xxs,
              }}>
                {isRevealed ? (isCorrect ? userInput : exercise.correctAnswer) : userInput || '___'}
              </Body>
            </View>
          </View>
          <HighlightedText text={afterBlank} highlight={highlight} />
        </Body>
      </View>

      {/* Hear the completed sentence. Only once it IS complete: before that
          the gap is the answer, and `exerciseListenTarget` fills the gap with
          `correctAnswer` to build the text, so playing it early would read the
          answer out loud. */}
      {isRevealed && listen && language ? (
        <ListenWordButton text={listen.text} language={language} userId={userId} />
      ) : null}

      {/* Input */}
      {!isRevealed && (
        <Ui2Input
          value={userInput}
          onChangeText={setUserInput}
          placeholder="Type the missing word..."
          autoFocus
          containerStyle={{ marginBottom: spacing.md }}
          inputStyle={{ fontSize: 18, textAlign: 'center' }}
          accessibilityLabel="Missing word"
        />
      )}

      {/* Hint — shared with every other typed row that carries one. */}
      <ExerciseHint hint={exercise.hintText} revealed={isRevealed} />

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

      {/* Check button — only before revealing */}
      {!isRevealed && (
        <Pressable
          onPress={handleCheck}
          disabled={userInput.trim().length === 0}
          style={{
            backgroundColor: c.primary,
            // The disabled look is an opacity, like SlabButton's: a paler fill
            // token would drop the white label under AA in the light scheme.
            opacity: userInput.trim().length > 0 ? 1 : 0.6,
            paddingVertical: spacing.md,
            borderRadius: radii.lg,
            alignItems: 'center',
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
