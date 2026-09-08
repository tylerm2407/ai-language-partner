import type { ReactNode } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { floatingTabBarSpace } from '../navigation/FloatingTabBar';
import { SlabButton } from '../ui2/SlabButton';
import { StepHero, type StepHeroTone } from '../ui2/StepHero';
import type { MascotMood } from '../ui2/MascotSol';
import { Body } from '../ui2/Ui2Text';
import { ExerciseNote, type ExerciseNoteState } from './ExerciseNote';
import { ExerciseChromeContext } from './exercise-chrome-context';
import { EXERCISE_TYPE_LABELS } from './ExerciseCard';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { spacing, typography } from '../../config/theme';
import type { ExerciseType } from '../../types';

interface ExerciseChromeProps {
  lessonTitle: string;
  currentIndex: number;
  total: number;
  completedCount?: number;
  /** Eyebrow beside the lesson title — "QUESTION 02", or "QUICK REVIEW 1 / 5". */
  counterLabel: string;
  /**
   * The exercise on screen. Puts the type's instruction ("Choose the correct
   * answer") in the hero as its title; the card underneath then skips its
   * own label. Optional so the existing prop contract, and every test that
   * uses it, is unchanged — without it the hero titles itself with the
   * lesson.
   */
  exerciseType?: ExerciseType;
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

/** What the hero block says for each note state. The verdict and the
 *  explanation moved UP here from the footer (canvas "Lesson chrome · A/B",
 *  variant B, 2026-09-08); the footer row keeps what the block does not say. */
interface HeroCopy {
  tone: StepHeroTone;
  title: string;
  subtitle?: string;
  mood: MascotMood;
}

function heroFor(state: ExerciseNoteState, instruction: string): HeroCopy {
  // Without an explanation the block still says what the answer was; the
  // footer kicker carries it too, in the same words the old chrome used.

  switch (state.kind) {
    case 'unanswered':
      return { tone: 'primary', title: instruction, mood: 'idle' };
    case 'retrying':
      return { tone: 'error', title: 'Not quite', subtitle: 'One more try.', mood: 'thinking' };
    case 'skipped':
      return { tone: 'primary', title: 'Skipped', mood: 'idle' };
    case 'correct':
      return { tone: 'green', title: 'Correct', subtitle: state.note ?? undefined, mood: 'cheer' };
    case 'recovered':
      return { tone: 'green', title: 'Correct, second try', subtitle: state.note ?? undefined, mood: 'cheer' };
    case 'wrong':
      return {
        tone: 'error',
        title: 'Not quite',
        subtitle: state.note ?? `The answer is ${state.correctAnswer}.`,
        mood: 'thinking',
      };
  }
}

/**
 * ExerciseChrome — the shared frame every exercise type renders inside.
 *
 * Tint blocks, lesson variant B "Hero card": ONE block on top (StepHero, the
 * same one onboarding uses) carries the exit ×, the lesson title and counter,
 * a segmented track, and the title — the type's instruction while the
 * learner is answering, the verdict and its explanation once they have. Sol
 * peeks over its edge and reacts. Below it the scrolling exercise body, and a
 * PINNED footer holding the note row, SKIP, and Previous / Next.
 *
 * Nothing the old chrome did is gone: the six note states (placeholder,
 * second try with Show answer, skipped, correct, recovered, wrong with the
 * correct answer), the skip affordance, the reserved note height, Finish on
 * the last exercise. The verdict simply lives in the block now, so the note
 * row says what the block does not: the correct answer on a miss, the count
 * on a hit, the "did not score" on a recovery.
 *
 * Layout contract (do not change without re-checking on a small device):
 *   hero                    flex: none
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
  exerciseType,
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
  const { c } = useUi2Theme();
  const insets = useSafeAreaInsets();
  const footerBottomInset = Math.max(
    spacing.md,
    floatingTabBarSpace() - insets.bottom + spacing.sm,
  );
  const answered = answeredCorrect !== null;
  const done = completedCount ?? currentIndex;
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

  const instruction = exerciseType ? EXERCISE_TYPE_LABELS[exerciseType] : lessonTitle;
  const hero = heroFor(noteState, instruction);
  const kicker = `${lessonTitle} · ${counterLabel}`;

  // The row repeats nothing the block already says. On a hit the explanation
  // is in the block, so the row carries the running count instead; on a miss
  // the kicker names the answer and the block explains; on a recovery the
  // row's "did not count" sentence is the part the block leaves out.
  const rowState: ExerciseNoteState =
    noteState.kind === 'correct'
      ? { kind: 'correct', note: `${Math.max(done, currentIndex + 1)} of ${total} answered.` }
      : noteState.kind === 'wrong'
        ? { kind: 'wrong', note: null, correctAnswer }
        : noteState.kind === 'recovered'
          ? { kind: 'recovered', note: null }
          : noteState;

  return (
    <ExerciseChromeContext.Provider value={{ instructionInHero: !!exerciseType }}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {/* Hero — exit, lesson title + counter, track, instruction or verdict */}
        <View style={{ paddingHorizontal: spacing.lg - 2, paddingTop: spacing.sm }}>
          <StepHero
            step={currentIndex + 1}
            total={total}
            done={done}
            kicker={kicker}
            text={hero.title}
            subtitle={hero.subtitle}
            tone={hero.tone}
            mood={hero.mood}
            leading="close"
            leadingLabel="Exit lesson"
            onBack={onExit}
            entrance="none"
          />
        </View>
        {/* Exercise body — the only scrolling region */}
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg - 2,
            // Sol overlaps the hero's bottom edge by 14pt; the body starts
            // under him rather than beside him.
            paddingTop: spacing.md + 6,
            // Clears the footer when the exercise is scrolled to the end, so
            // the card never sits flush against the note row.
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
            paddingTop: spacing.sm,
            paddingBottom: footerBottomInset,
            // Opaque, and stated rather than inherited. The footer sits
            // directly beneath a scrolling region: anything translucent here
            // lets a long exercise show through the note as it scrolls past,
            // which reads as the two overlapping.
            backgroundColor: c.bg,
          }}
        >
          <View
            style={{
              minHeight: retry ? NOTE_MIN_HEIGHT_RETRY : NOTE_MIN_HEIGHT,
              paddingBottom: spacing.sm + 2,
              paddingHorizontal: spacing.xs,
              flexDirection: 'row',
              // Centred, not top-aligned: the one-line placeholder used to pin
              // itself to the top of the reserved block, hard against the
              // clipped card above, while ~60pt of the reserve sat empty below.
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <ExerciseNote state={rowState} />
            </View>
            {/* Skip. Styled like a text-only action rather than given a third
                footer button: three buttons across a 375pt screen is three
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
                    color: c.idle,
                  }}
                >
                  SKIP
                </Body>
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SlabButton
              label="Previous"
              variant="tint"
              arrow={false}
              onPress={onPrev}
              disabled={!canPrev}
              style={{ flex: 1 }}
            />
            <SlabButton
              label={isLast ? 'Finish' : 'Next'}
              variant="primary"
              onPress={onNext}
              disabled={!canNext}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </ExerciseChromeContext.Provider>
  );
}
