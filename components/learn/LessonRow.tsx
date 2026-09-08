/**
 * LessonRow — one lesson in the selected unit's list.
 *
 * Four visual states, each carrying real data in the right-hand slot rather
 * than a decorative tag:
 *
 *   completed  filled card, green dot, score            `94%`
 *   active     indigo card + border, play glyph, meta    [ GO ]
 *   upcoming   dashed outline, dimmed, reward            `+20 XP`
 *   milestone  dashed outline, violet rhombus            `MILESTONE`
 *
 * "milestone" is the upcoming state for a unit's final lesson — the curriculum
 * places one "Review & Test" at the end of every unit (see
 * lib/learn-progress.ts `isMilestoneLesson`). Once it is reachable or done it
 * renders like any other row, because at that point its state is the news.
 *
 * Locked rows are rendered `disabled`: sequential unlocking is the progression
 * model, so a tap must not navigate. They stay in the accessibility tree with
 * a hint saying what unlocks them — a row a screen reader cannot reach is a
 * lesson the learner cannot know exists.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Body } from '../ui2/Ui2Text';
import { Mono } from './Mono';
import { DashedOutline } from './DashedOutline';
import { usePressed } from '../../hooks/usePressed';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { radii, spacing, typography } from '../../config/theme';
import type { LessonRowState } from '../../lib/learn-progress';

interface LessonRowProps {
  /** 1-based position within the unit — the `01` gutter. */
  position: number;
  title: string;
  state: LessonRowState;
  isMilestone: boolean;
  /** 0-1, from lesson_completions. Null when never completed. */
  score: number | null;
  xpReward: number;
  estimatedMinutes: number;
  onPress: () => void;
}

const ROW_RADIUS = radii.lg;

function LessonRowComponent({
  position,
  title,
  state,
  isMilestone,
  score,
  xpReward,
  estimatedMinutes,
  onPress,
}: LessonRowProps) {
  const { c } = useUi2Theme();
  const { pressed, pressHandlers } = usePressed();
  const locked = state === 'locked';
  const active = state === 'active';
  const completed = state === 'completed';
  // The violet milestone treatment only applies while the row is still out of
  // reach; an active or finished review reads by its own state.
  const milestoneLocked = locked && isMilestone;

  const indexColor = completed
    ? c.green
    : active
      ? c.primary
      : milestoneLocked
        ? c.primary
        : c.idle;

  const accessibilityLabel = buildLabel({
    position,
    title,
    state,
    isMilestone,
    score,
    xpReward,
    estimatedMinutes,
  });

  return (
    <Pressable
      onPress={onPress}
      {...pressHandlers}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={
        locked
          ? 'Locked. Finish the lesson before it to unlock this one.'
          : completed
            ? 'Opens this lesson again for practice.'
            : undefined
      }
      accessibilityState={{ disabled: locked }}
      style={[
        styles.row,
        completed && { backgroundColor: c.card },
        active && { backgroundColor: c.primaryTint, borderColor: c.primaryTintBorder },
        active && styles.rowActiveTall,
        pressed && !locked && styles.rowPressed,
      ]}
    >
      {locked && (
        <DashedOutline
          radius={ROW_RADIUS}
          color={milestoneLocked ? c.primaryTintBorder : c.cardBorder}
        />
      )}

      <Mono size={12} medium color={indexColor} style={styles.index}>
        {String(position).padStart(2, '0')}
      </Mono>

      <View style={styles.glyph}>
        <StateGlyph state={state} milestoneLocked={milestoneLocked} />
      </View>

      <View style={styles.titleColumn}>
        <Body
          size={active ? 'lg' : 'md'}
          weight={active ? 'extrabold' : completed ? 'bold' : 'semibold'}
          tone={locked ? 'tertiary' : 'primary'}
          numberOfLines={active ? 2 : 1}
        >
          {title}
        </Body>
        {active && (
          <Mono size={11} color={c.idle} style={styles.activeMeta}>
            {`${estimatedMinutes} MIN`}
          </Mono>
        )}
      </View>

      <TrailingSlot
        state={state}
        milestoneLocked={milestoneLocked}
        score={score}
        xpReward={xpReward}
      />
    </Pressable>
  );
}

export const LessonRow = React.memo(LessonRowComponent);

// ─── Leading glyph ────────────────────────────────────────────────────────

function StateGlyph({
  state,
  milestoneLocked,
}: {
  state: LessonRowState;
  milestoneLocked: boolean;
}) {
  const { c } = useUi2Theme();
  if (state === 'completed') {
    return <View style={[styles.dot, { backgroundColor: c.green }]} />;
  }
  if (state === 'active') {
    // Drawn rather than iconed: a CSS-style border triangle keeps the same
    // optical weight as the 10px dot and rhombus beside it, which Ionicons'
    // `play` glyph does not at this size.
    return <View style={[styles.triangle, { borderLeftColor: c.primary }]} />;
  }
  return (
    <View
      style={[
        styles.rhombus,
        { backgroundColor: milestoneLocked ? c.primary : c.idle },
      ]}
    />
  );
}

// ─── Trailing slot ────────────────────────────────────────────────────────

function TrailingSlot({
  state,
  milestoneLocked,
  score,
  xpReward,
}: {
  state: LessonRowState;
  milestoneLocked: boolean;
  score: number | null;
  xpReward: number;
}) {
  const { c } = useUi2Theme();
  if (state === 'active') {
    // A View, not a nested Pressable: the whole row is the target, and a
    // second touchable here would split it into two accessibility nodes.
    return (
      <View style={[styles.goPill, { backgroundColor: c.primary }]}>
        <Body size="sm" weight="extrabold" tone="onPrimary" style={styles.goLabel}>
          GO
        </Body>
      </View>
    );
  }

  if (state === 'completed') {
    return (
      <Mono size={11} medium color={c.green}>
        {score === null ? 'DONE' : `${Math.round(score * 100)}%`}
      </Mono>
    );
  }

  if (milestoneLocked) {
    return (
      <Mono size={11} medium color={c.primary}>
        MILESTONE
      </Mono>
    );
  }

  // Nothing to advertise here any more: XP is a server-side ledger, not a
  // number the learner is playing for.
  return null;
}

// ─── Accessibility copy ───────────────────────────────────────────────────

function buildLabel({
  position,
  title,
  state,
  isMilestone,
  score,
  xpReward,
  estimatedMinutes,
}: Pick<
  LessonRowProps,
  'position' | 'title' | 'state' | 'isMilestone' | 'score' | 'xpReward' | 'estimatedMinutes'
>): string {
  const parts = [`Lesson ${position}`, title];

  if (state === 'completed') {
    parts.push(score === null ? 'completed' : `completed, scored ${Math.round(score * 100)} percent`);
  } else if (state === 'active') {
    parts.push('next up', `${estimatedMinutes} minutes`);
  } else {
    parts.push('locked');
  }

  if (isMilestone) parts.push('unit review');

  return parts.join(', ');
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // 44pt Apple HIG minimum with room to spare; the gutter + glyph + trailing
    // label all sit on one baseline at this height.
    // 52, not 64 (canvas "Learn · variations", L2): still 8pt over the HIG
    // minimum, and six lessons fit above the fold.
    minHeight: 52,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    borderRadius: ROW_RADIUS,
  },
  rowActiveTall: {
    minHeight: 72,
  },
  rowPressed: {
    opacity: 0.72,
  },
  index: {
    width: 26,
  },
  glyph: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  activeMeta: {
    marginTop: 3,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  triangle: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    // Optical centering — a triangle's visual mass sits left of its box.
    marginLeft: 2,
  },
  rhombus: {
    width: 10,
    height: 10,
    transform: [{ rotate: '45deg' }],
  },
  goPill: {
    minWidth: 62,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  goLabel: {
    letterSpacing: typography.tracking.cta,
  },
});
