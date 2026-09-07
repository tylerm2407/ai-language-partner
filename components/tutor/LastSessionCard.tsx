/**
 * "Last session: 8 min · you worked on the past tense."
 *
 * One line on the lobby, and it is doing more work than its size suggests. A
 * learner opening the tutor tab is deciding whether to start a call, and the
 * strongest argument for starting one is evidence that the last one went
 * somewhere. Progress in this app is measured, not scored (§1) — so the line
 * says what was WORKED ON, never a number of points.
 *
 * ── THREE STATES, AND THE MIDDLE ONE IS THE IMPORTANT ONE ──
 *
 *  loading      — a spinner and a label, so the row keeps its height and the
 *                 lobby does not reflow under the learner's thumb when the
 *                 query lands.
 *  no history   — the first-timer. This is where an empty card would do real
 *                 damage: the person with the least reason to press the button
 *                 gets shown a blank box confirming they have done nothing.
 *                 They get an invitation instead, and it names the one thing
 *                 they are worried about — that they will not know what to say.
 *  a session    — the real line.
 *
 * The formatting is a pure function so all three, and the awkward numbers, are
 * testable without a renderer.
 */

import { ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { SlabCard } from '../ui2/SlabCard';
import { Body, Caption } from '../ui2/Ui2Text';

/** Copy for the learner who has never had a call. Exported so a screen can
 *  reuse the exact words rather than writing a second welcome. */
export const FIRST_SESSION_INVITATION = 'Your first call. Say hello — your tutor takes it from there.';

/**
 * "8 min", "1 min", "Under a minute".
 *
 * A call that lasted forty seconds is a real call and must not render as
 * "0 min", which reads as a failure the learner did not have. Negative and
 * non-finite values are treated as unknown rather than clamped and displayed —
 * a duration we cannot trust is not one to state.
 */
export function formatSessionMinutes(minutes: number | null): string | null {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return null;
  // The test is on the RAW value, not the rounded one: 0.6 minutes is
  // thirty-six seconds, and rounding first would announce it as a full minute
  // of conversation that did not happen.
  if (minutes < 1) return 'Under a minute';
  return `${Math.round(minutes)} min`;
}

/**
 * The whole line, or `null` when there is nothing honest to say.
 *
 * Either half may be missing: a session with no headline (the debrief has not
 * been generated, or the call was too short to summarise) still shows its
 * length, and a headline whose duration failed to load still shows the
 * headline. `null` only when both are gone, which the card renders as the
 * first-timer state — the same thing a learner with no history sees, because
 * from their side the two are indistinguishable and inventing a difference
 * would mean inventing a fact.
 */
export function formatLastSession(minutes: number | null, headline: string | null): string | null {
  const duration = formatSessionMinutes(minutes);
  const trimmedHeadline = headline?.trim() ? headline.trim() : null;
  if (duration && trimmedHeadline) return `Last session: ${duration} · ${trimmedHeadline}`;
  if (duration) return `Last session: ${duration}`;
  if (trimmedHeadline) return `Last session: ${trimmedHeadline}`;
  return null;
}

interface LastSessionCardProps {
  minutes: number | null;
  headline: string | null;
  loading: boolean;
}

export function LastSessionCard({ minutes, headline, loading }: LastSessionCardProps) {
  const { c } = useUi2Theme();

  if (loading) {
    return (
      <SlabCard style={styles.card} accessibilityRole="text" accessibilityLabel="Loading your last session">
        <ActivityIndicator color={c.primary} />
        <Caption tone="tertiary">Checking your last session…</Caption>
      </SlabCard>
    );
  }

  const line = formatLastSession(minutes, headline);

  if (line === null) {
    return (
      <SlabCard style={styles.card} accessibilityRole="text" accessibilityLabel={FIRST_SESSION_INVITATION}>
        <Ionicons name="sparkles-outline" size={18} color={c.primary} />
        <Body size="sm" tone="secondary" style={styles.text}>
          {FIRST_SESSION_INVITATION}
        </Body>
      </SlabCard>
    );
  }

  return (
    <SlabCard style={styles.card} accessibilityRole="text" accessibilityLabel={line}>
      <Ionicons name="time-outline" size={18} color={c.idle} />
      <Body size="sm" tone="secondary" style={styles.text}>
        {line}
      </Body>
    </SlabCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // Fixed floor rather than a fixed height: the line wraps at large Dynamic
    // Type sizes, and a hard height would clip it. The floor is what stops the
    // lobby jumping when the loading state resolves to a one-line answer.
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    flex: 1,
  },
});
