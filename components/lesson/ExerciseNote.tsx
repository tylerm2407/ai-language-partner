import { View, Pressable } from 'react-native';
import { Body } from '../ui2/Ui2Text';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { spacing, typography } from '../../config/theme';

/**
 * What the pinned footer says about the current exercise.
 *
 * Six states rather than the original two, because a second attempt and a skip
 * are both things the learner needs told plainly:
 *
 *   retrying   — one more try, and the answer stays hidden until it is spent
 *   recovered  — right on the second attempt, so it taught but did not score
 *   correct    — right first time
 *   wrong      — out of attempts; the answer is revealed
 *   skipped    — neutral; the answer is NOT revealed, or skip becomes a cheat
 *   unanswered — the placeholder
 *
 * The kicker text carries the verdict alongside the colour, so none of these
 * states is signalled by colour alone.
 */
export type ExerciseNoteState =
  | { kind: 'retrying'; onGiveUp: () => void }
  | { kind: 'recovered'; note: string | null }
  | { kind: 'correct'; note: string | null }
  | { kind: 'wrong'; note: string | null; correctAnswer: string }
  | { kind: 'skipped' }
  | { kind: 'unanswered' };

const KICKER_STYLE = {
  fontFamily: typography.family.mono,
  fontSize: 10,
  letterSpacing: typography.tracking.eyebrow,
} as const;

const BODY_STYLE = { fontSize: 13, lineHeight: 19 } as const;

export function ExerciseNote({ state }: { state: ExerciseNoteState }) {
  const { c } = useUi2Theme();
  if (state.kind === 'unanswered') {
    // `idle`, not `muted`: this is instruction copy at 13px and the placeholder
    // step is what the design reserves for text nobody has to read yet.
    return (
      <Body size="sm" style={{ color: c.idle, ...BODY_STYLE }}>
        Pick an answer to see the note.
      </Body>
    );
  }

  if (state.kind === 'retrying') {
    return (
      <View style={{ gap: spacing.xs }}>
        <Body
          size="sm"
          accessibilityLiveRegion="polite"
          style={{ color: c.muted, ...BODY_STYLE }}
        >
          <Body size="sm" style={{ ...KICKER_STYLE, color: c.yellow }}>
            {'NOT QUITE — '}
          </Body>
          One more try. The answer stays hidden until then.
        </Body>
        {/* Without this the learner is trapped: Next stays disabled until the
            exercise resolves, and every typed exercise refuses to submit an
            empty answer. Going blank has to have an exit. */}
        <Pressable
          onPress={state.onGiveUp}
          hitSlop={12}
          style={{ minHeight: 44, justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Show the answer and move on"
        >
          <Body
            size="sm"
            style={{ ...KICKER_STYLE, fontSize: 12, color: c.idle }}
          >
            SHOW ANSWER
          </Body>
        </Pressable>
      </View>
    );
  }

  if (state.kind === 'skipped') {
    return (
      <Body
        size="sm"
        accessibilityLiveRegion="polite"
        style={{ color: c.muted, ...BODY_STYLE }}
      >
        <Body size="sm" style={{ ...KICKER_STYLE, color: c.idle }}>
          {'SKIPPED — '}
        </Body>
        This one won&apos;t count. You&apos;ll see it again in review.
      </Body>
    );
  }

  const { kicker, color } =
    state.kind === 'correct'
      ? { kicker: 'CORRECT — ', color: c.green }
      : state.kind === 'recovered'
        ? { kicker: 'SECOND TRY — ', color: c.yellow }
        : { kicker: `ANSWER: ${state.correctAnswer.toUpperCase()} — `, color: c.error };

  const lead =
    state.kind === 'recovered'
      ? "Correct, but it doesn't count toward your score. "
      : '';

  return (
    <Body
      size="sm"
      accessibilityLiveRegion="polite"
      style={{ color: c.muted, ...BODY_STYLE }}
    >
      <Body size="sm" style={{ ...KICKER_STYLE, color }}>
        {kicker}
      </Body>
      {lead}
      {state.note ?? ''}
    </Body>
  );
}
