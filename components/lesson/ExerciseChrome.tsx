import type { ReactNode } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { HeartsDisplay } from '../gamification/HeartsDisplay';
import { TactileButton } from '../ui/TactileButton';
import { Body } from '../ui/Text';
import { ExerciseTrack } from './ExerciseTrack';
import { colors, spacing, typography } from '../../config/theme';

interface ExerciseChromeProps {
  lessonTitle: string;
  currentIndex: number;
  total: number;
  completedCount?: number;
  /** Eyebrow above the prompt — "QUESTION 02", or "QUICK REVIEW 1 / 5". */
  counterLabel: string;
  hearts: number;
  maxHearts: number;
  isUnlimitedHearts: boolean;
  showHearts: boolean;
  /** exercise.explanation, or null when the exercise has none. */
  note: string | null;
  /** null before the learner answers. */
  answeredCorrect: boolean | null;
  /** Correct answer, shown in the note kicker after a wrong pick. */
  correctAnswer: string;
  canPrev: boolean;
  canNext: boolean;
  isLast: boolean;
  onExit: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** The exercise itself (prompt + answer input). */
  children: ReactNode;
}

/** Reserved so the layout does not jump when the note appears. */
const NOTE_MIN_HEIGHT = 58;

/**
 * ExerciseChrome — the shared frame every exercise type renders inside:
 * header, tick track, hearts row, scrolling exercise body, and a PINNED
 * footer holding the note row and Previous/Next.
 *
 * Layout contract (do not change without re-checking on a small device):
 *   header + track + meta   flex: none
 *   exercise body           flex: 1, minHeight: 0, scrollable
 *   note + Previous/Next    flex: none
 *
 * The footer must never live inside the scroll area — the note appears
 * exactly when the learner needs it, and it would render below the fold.
 */
export function ExerciseChrome({
  lessonTitle,
  currentIndex,
  total,
  completedCount,
  counterLabel,
  hearts,
  maxHearts,
  isUnlimitedHearts,
  showHearts,
  note,
  answeredCorrect,
  correctAnswer,
  canPrev,
  canNext,
  isLast,
  onExit,
  onPrev,
  onNext,
  children,
}: ExerciseChromeProps) {
  const answered = answeredCorrect !== null;
  const kicker = !answered
    ? null
    : answeredCorrect
      ? 'CORRECT — '
      : `ANSWER: ${correctAnswer.toUpperCase()} — `;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.raised }}>
      {/* Header — unit name + text-only exit */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg - 2,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm + 2,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.subtle,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs + 2,
            flex: 1,
            paddingRight: spacing.sm,
          }}
        >
          <View
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.action.accent }}
          />
          <Body size="sm" weight="bold" numberOfLines={1} style={{ color: colors.text.primary }}>
            {lessonTitle}
          </Body>
        </View>
        <Pressable
          onPress={onExit}
          accessibilityRole="button"
          accessibilityLabel="Exit lesson"
          hitSlop={12}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Body
            size="sm"
            weight="extrabold"
            style={{
              color: colors.text.tertiary,
              fontSize: 12,
              letterSpacing: typography.tracking.banner + 0.2,
            }}
          >
            EXIT
          </Body>
        </Pressable>
      </View>

      {/* Tick track + meta row */}
      <View style={{ paddingHorizontal: spacing.lg - 2, paddingTop: spacing.md }}>
        <ExerciseTrack total={total} currentIndex={currentIndex} completedCount={completedCount} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.sm,
          }}
        >
          <Body
            size="sm"
            style={{
              fontFamily: typography.family.mono,
              fontSize: 10,
              letterSpacing: typography.tracking.eyebrow,
              color: colors.text.tertiary,
            }}
          >
            {counterLabel}
          </Body>
          {showHearts && (
            <HeartsDisplay
              hearts={hearts}
              maxHearts={maxHearts}
              isUnlimited={isUnlimitedHearts}
              size={14}
            />
          )}
        </View>
      </View>

      {/* Exercise body — the only scrolling region */}
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg - 2,
          paddingTop: spacing.lg + 6,
          paddingBottom: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {/* Pinned footer — note row, then navigation */}
      <View
        style={{
          paddingHorizontal: spacing.lg - 2,
          paddingTop: spacing.sm + 2,
          paddingBottom: spacing.xl + 4,
          borderTopWidth: 1,
          borderTopColor: colors.border.subtle,
        }}
      >
        <View style={{ minHeight: NOTE_MIN_HEIGHT, paddingBottom: spacing.md }}>
          {answered ? (
            <Body
              size="sm"
              accessibilityLiveRegion="polite"
              style={{ color: colors.text.secondary, fontSize: 13, lineHeight: 19 }}
            >
              <Body
                size="sm"
                style={{
                  fontFamily: typography.family.mono,
                  fontSize: 10,
                  letterSpacing: typography.tracking.eyebrow,
                  color: answeredCorrect ? colors.success.light : colors.error.light,
                }}
              >
                {kicker}
              </Body>
              {note ?? ''}
            </Body>
          ) : (
            // text.tertiary, not text.quaternary: this is instruction copy at
            // 13px, and quaternary (3.9:1) is a large-UI-only step.
            <Body
              size="sm"
              style={{ color: colors.text.tertiary, fontSize: 13, lineHeight: 19 }}
            >
              Pick an answer to see the note.
            </Body>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TactileButton
            label="Previous"
            variant="secondary"
            onPress={onPrev}
            disabled={!canPrev}
            style={{ flex: 1 }}
          />
          <TactileButton
            label={isLast ? 'Finish' : 'Next'}
            variant="primary"
            onPress={onNext}
            disabled={!canNext}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
}
