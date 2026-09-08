import { View, Text, Pressable } from 'react-native';
import { haptic } from '../../lib/haptics';
import { ExerciseCard } from './ExerciseCard';
import { HighlightedText } from '../shared/HighlightedText';
import { gradeAnswer } from '../../lib/grading';
import { logExerciseCorrection } from '../../lib/supabase-queries';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { radii, spacing, typography } from '../../config/theme';
import type { Exercise, FeedbackErrorType, LanguageCode } from '../../types';

interface MultipleChoiceProps {
  exercise: Exercise;
  /**
   * The learner's pick, owned by LessonRunner so Previous restores it.
   * This replaced the component's own useState — local state made going
   * back to an answered exercise show it as unanswered.
   *
   * Optional so the runner can adopt this component before it owns the
   * pick map.
   */
  selected?: string | null;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  /** Correction-log context. Logging happens here rather than in a
   *  FeedbackCard, which this type no longer renders. */
  userId?: string;
  language?: string;
  cefrLevel?: string;
}

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function MultipleChoice({
  exercise,
  selected = null,
  onAnswer,
  showResult,
  userId,
  language,
}: MultipleChoiceProps) {
  const { c } = useUi2Theme();
  const options = exercise.options ?? [];
  const locked = selected !== null || showResult;

  const isCorrectOption = (option: string) =>
    option.toLowerCase() === exercise.correctAnswer.toLowerCase() ||
    exercise.acceptedAnswers.map((a) => a.toLowerCase()).includes(option.toLowerCase());

  const handleSelect = (option: string) => {
    if (locked) return;
    const grade = gradeAnswer(option, exercise.correctAnswer, exercise.acceptedAnswers, {
      exerciseHints: {
        exerciseType: exercise.type,
        skillType: exercise.skillType,
        targetGrammar: exercise.targetGrammar,
        targetWord: exercise.targetWord,
        language: language as LanguageCode | undefined,
      },
    });
    haptic(grade.isCorrect ? 'correct' : 'incorrect');

    // This type used to log its correction from inside FeedbackCard's mount
    // effect. The card is gone — the footer note replaced it — so the log
    // moved here, to the event that grades the answer. That is also the
    // safer home: an effect would re-fire every time Previous walked back
    // onto an answered exercise, and this fires exactly once per pick.
    logCorrection(grade.errorType, grade.normalizedUserAnswer, exercise, userId, language);

    onAnswer(grade.isCorrect, option);
  };

  /**
   * Tint blocks: a row is a filled block with no outline. Unanswered rows sit
   * on the ground tint with a white key tile; once locked, the right answer
   * becomes a solid green block and a wrong pick a solid error block, each
   * with its label in the on-tone ink and a white key tile. The verdict is
   * carried by the word (CORRECT / YOUR PICK), the fill and the tile — never
   * by colour alone.
   */
  const rowPalette = (option: string) => {
    const isPick = option === selected;
    const right = isCorrectOption(option);
    if (!locked) {
      return {
        bg: c.bg,
        keyBg: c.primaryTint,
        keyText: c.onTint,
        label: c.ink,
        weight: '600' as const,
        mark: null as string | null,
        markColor: 'transparent',
      };
    }
    if (right) {
      return {
        bg: c.green,
        keyBg: c.onPrimary,
        keyText: c.green,
        label: c.onGreen,
        weight: '700' as const,
        mark: 'CORRECT',
        markColor: c.onGreen,
      };
    }
    if (isPick) {
      return {
        bg: c.error,
        keyBg: c.onPrimary,
        keyText: c.error,
        label: c.onError,
        weight: '700' as const,
        mark: 'YOUR PICK',
        markColor: c.onError,
      };
    }
    return {
      bg: c.bg,
      keyBg: c.surface2,
      keyText: c.idle,
      label: c.idle,
      weight: '600' as const,
      mark: null,
      markColor: 'transparent',
    };
  };

  const highlight = exercise.targetWord ?? exercise.targetGrammar;

  return (
    <ExerciseCard
      type={exercise.type}
      promptNode={
        <HighlightedText
          text={exercise.prompt}
          highlight={highlight}
          className="text-[22px] font-sans-semibold"
          style={{ color: c.ink }}
        />
      }
    >
      <View style={{ gap: spacing.xs + 2 }}>
        {options.map((option, index) => {
          const p = rowPalette(option);
          const key = KEYS[index] ?? String(index + 1);
          return (
            <Pressable
              key={index}
              onPress={() => handleSelect(option)}
              disabled={locked}
              accessibilityRole="button"
              accessibilityLabel={`Option ${key}: ${option}`}
              accessibilityState={{ selected: option === selected, disabled: locked }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm + 2,
                // 54, not 62. Four options plus their gaps is the tallest
                // thing any exercise puts in the body, and the footer below is
                // pinned — so every point here is a point the last option
                // loses against the note's top rule on a small screen. Still
                // 10pt clear of the 44pt minimum target (.claude/rules/
                // mobile-ui.md), and the row grows past this for a long option.
                minHeight: 54,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 2,
                borderRadius: radii.lg,
                backgroundColor: p.bg,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radii.sm,
                  backgroundColor: p.keyBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{ fontFamily: typography.family.mono, fontSize: 12, color: p.keyText }}
                >
                  {key}
                </Text>
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily:
                    p.weight === '700' ? typography.family.bold : typography.family.semibold,
                  fontSize: 17,
                  lineHeight: 24,
                  color: p.label,
                }}
              >
                {option}
              </Text>
              {p.mark && (
                <Text
                  style={{
                    fontFamily: typography.family.mono,
                    fontSize: 9,
                    letterSpacing: typography.tracking.eyebrow,
                    color: p.markColor,
                  }}
                >
                  {p.mark}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </ExerciseCard>
  );
}

/** Fire-and-forget correction_log write. Mirrors FeedbackCard's effect: only
 *  incorrect answers with a classified error type are worth a row, and a
 *  logging hiccup must never break the lesson. */
function logCorrection(
  errorType: FeedbackErrorType | null | undefined,
  normalizedUserAnswer: string | undefined,
  exercise: Exercise,
  userId: string | undefined,
  language: string | undefined,
): void {
  if (!errorType || !userId || !language) return;

  void logExerciseCorrection({
    userId,
    exerciseId: exercise.id,
    errorType,
    original: normalizedUserAnswer || '',
    corrected: exercise.correctAnswer,
    shortLabel:
      exercise.targetGrammar || exercise.targetWord || exercise.subskill || errorType,
    explanation: exercise.explanation ?? null,
    severity: 'minor',
    targetLanguage: language,
  }).catch((err) => {
    console.warn('[MultipleChoice] logExerciseCorrection failed:', err);
  });
}
