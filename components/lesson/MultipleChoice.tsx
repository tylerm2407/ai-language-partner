import { View, Text, Pressable } from 'react-native';
import { haptic } from '../../lib/haptics';
import { ExerciseCard } from './ExerciseCard';
import { HighlightedText } from '../shared/HighlightedText';
import { gradeAnswer } from '../../lib/grading';
import { logExerciseCorrection } from '../../lib/supabase-queries';
import { colors, radii, spacing, typography } from '../../config/theme';
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
   * Answered rows earn a border and a key-tile fill; unanswered-and-not-picked
   * rows keep surface.cardAlt with a tertiary label. They are never dropped to
   * the card's own fill — that dissolves the row and drops the label under AA.
   */
  const rowPalette = (option: string) => {
    const isPick = option === selected;
    const right = isCorrectOption(option);
    if (!locked) {
      return {
        bg: colors.surface.cardAlt,
        border: colors.border.subtle,
        keyBg: colors.surface.card,
        keyText: colors.text.tertiary,
        label: colors.text.secondary,
        weight: '600' as const,
        mark: null as string | null,
        markColor: 'transparent',
      };
    }
    if (right) {
      return {
        bg: colors.success.tint,
        border: colors.success.base,
        keyBg: colors.success.base,
        keyText: colors.text.onSuccess,
        label: colors.text.primary,
        weight: '700' as const,
        mark: 'CORRECT',
        markColor: colors.success.light,
      };
    }
    if (isPick) {
      return {
        bg: colors.error.tint,
        border: colors.error.base,
        keyBg: colors.error.base,
        keyText: colors.text.onPrimary,
        label: colors.text.primary,
        weight: '700' as const,
        mark: 'YOUR PICK',
        markColor: colors.error.light,
      };
    }
    return {
      bg: colors.surface.cardAlt,
      border: colors.border.subtle,
      keyBg: colors.surface.card,
      keyText: colors.text.tertiary,
      label: colors.text.tertiary,
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
          className="text-text-primary text-[22px] font-sans-semibold"
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
                minHeight: 62,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs + 2,
                borderRadius: radii.lg,
                backgroundColor: p.bg,
                borderWidth: 1,
                borderColor: p.border,
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
