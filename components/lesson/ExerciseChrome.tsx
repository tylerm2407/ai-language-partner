import type { ReactNode } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { floatingTabBarSpace } from '../navigation/FloatingTabBar';
import { TactileButton } from '../ui/TactileButton';
import { Body } from '../ui/Text';
import { ExerciseTrack } from './ExerciseTrack';
import { ExerciseNote, type ExerciseNoteState } from './ExerciseNote';
import { colors, spacing, typography } from '../../config/theme';

interface ExerciseChromeProps {
  lessonTitle: string;
  currentIndex: number;
  total: number;
  completedCount?: number;
  /** Eyebrow above the prompt — "QUESTION 02", or "QUICK REVIEW 1 / 5". */
  counterLabel: string;
  /** exercise.explanation, or null when the exercise has none. */
  note: string | null;
  /**
   * null before the learner answers — and also while a second attempt is
   * open, which is what keeps the reveal below shut until it is spent.
   */
  answeredCorrect: boolean | null;
  /**
   * A second attempt is open. Takes precedence over every other note state:
   * nothing about the answer may be shown while this is set.
   *
   * Additive and optional, like the three below, so the whole existing prop
   * contract — and every test that uses it — is unchanged.
   */
  retry?: { onGiveUp: () => void } | null;
  /** `answeredCorrect` is true, but it took a second attempt, so it did not score. */
  recovered?: boolean;
  /** Neutral outcome. Not scored, and the answer is NOT revealed. */
  skipped?: boolean;
  /** Skip affordance. Omit entirely to hide it — most types never offer one. */
  onSkip?: (() => void) | null;
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

/** Reserved so the layout does not jump when the note appears.
 *
 *  Sized for the tallest state — the retry row, which is a kicker line (19pt)
 *  plus a gap and a 44pt "Show answer" target. The old 58 fitted a kicker and
 *  two lines of body and would have made the footer jump every time a second
 *  attempt opened. */
const NOTE_MIN_HEIGHT_RETRY = 76;

/** Reserved for every other state.
 *
 *  Reserving the retry height ALWAYS cost 36pt on every exercise, and the
 *  footer already spends ~216pt before the note: 16 top padding, the note row
 *  and its 16 bottom padding, a ~50pt navigation row, and up to 76pt clearing
 *  the floating tab bar. On a 667pt screen that left the body too little room
 *  for a four-option multiple choice — four 62pt options plus gaps is 278pt
 *  before the prompt card — so the options were squeezed against the note.
 *
 *  56 fits the tallest non-retry state (a kicker plus two 19pt body lines).
 *  Entering a second attempt now grows the row by 20pt, which is both smaller
 *  than the 34pt jump the old constant was chosen to avoid and paid only when
 *  the learner got something wrong, rather than on every question. */
const NOTE_MIN_HEIGHT = 56;

/**
 * ExerciseChrome — the shared frame every exercise type renders inside:
 * header, tick track, counter row, scrolling exercise body, and a PINNED
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
  note,
  answeredCorrect,
  retry = null,
  recovered = false,
  skipped = false,
  onSkip = null,
  correctAnswer,
  canPrev,
  canNext,
  isLast,
  onExit,
  onPrev,
  onNext,
  children,
}: ExerciseChromeProps) {
  const insets = useSafeAreaInsets();
  // The lesson route lives inside the tab navigator, and FloatingTabBar is
  // absolutely positioned over it — so a footer pinned to the bottom has to
  // reserve the bar's space or Previous/Next render underneath it. The parent
  // SafeAreaView already consumes insets.bottom, so subtract it back out.
  const footerBottomInset = Math.max(
    spacing.md,
    floatingTabBarSpace() - insets.bottom + spacing.sm,
  );
  const answered = answeredCorrect !== null;
  // Precedence: retry > skipped > recovered > answered > placeholder. The
  // first two are states in which the answer must stay hidden, so they have to
  // win over anything that would reveal it.
  const noteState: ExerciseNoteState = retry
    ? { kind: 'retrying', onGiveUp: retry.onGiveUp }
    : skipped
      ? { kind: 'skipped' }
      : !answered
        ? { kind: 'unanswered' }
        : answeredCorrect
          ? recovered
            ? { kind: 'recovered', note }
            : { kind: 'correct', note }
          : { kind: 'wrong', note, correctAnswer };

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
        </View>
      </View>

      {/* Exercise body — the only scrolling region */}
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg - 2,
          // Was spacing.lg + 6. The header above already separates itself with
          // its own padding and a rule, so this was doubling a gap that was
          // costing the exercise body 14pt it needed more.
          paddingTop: spacing.md,
          // Clears the footer's top rule when the exercise is scrolled to the
          // end, so the card never sits flush against the note row.
          paddingBottom: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {/* Pinned footer — note row, then navigation */}
      <View
        style={{
          paddingHorizontal: spacing.lg - 2,
          paddingTop: spacing.md,
          paddingBottom: footerBottomInset,
          // Opaque, and stated rather than inherited. The footer sits directly
          // beneath a scrolling region: anything translucent here lets a
          // long exercise show through the note as it scrolls past, which
          // reads as the two overlapping.
          backgroundColor: colors.surface.raised,
          // Without a rule the note reads as the last line inside the question
          // card rather than a separate region.
          borderTopWidth: 1,
          borderTopColor: colors.border.subtle,
        }}
      >
        <View
          style={{
            minHeight: retry ? NOTE_MIN_HEIGHT_RETRY : NOTE_MIN_HEIGHT,
            paddingBottom: spacing.md,
            flexDirection: 'row',
            // Centred, not top-aligned: the one-line placeholder used to pin
            // itself to the top of the reserved block, hard against the
            // clipped card above, while ~60pt of the reserve sat empty below.
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <ExerciseNote state={noteState} />
          </View>

          {/* Skip. Styled like the header's text-only EXIT rather than given a
              third footer button: three buttons across a 375pt screen is three
              cramped targets, and this is deliberately the quiet option. */}
          {onSkip ? (
            <Pressable
              onPress={onSkip}
              hitSlop={12}
              style={{ minHeight: 44, justifyContent: 'center' }}
              accessibilityRole="button"
              accessibilityLabel="Skip this question without scoring it"
            >
              <Body
                size="sm"
                style={{
                  fontFamily: typography.family.mono,
                  fontSize: 12,
                  fontWeight: '800',
                  letterSpacing: typography.tracking.banner + 0.2,
                  color: colors.text.tertiary,
                }}
              >
                SKIP
              </Body>
            </Pressable>
          ) : null}
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
