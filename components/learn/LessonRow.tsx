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
import { Body } from '../ui/Text';
import { Mono } from './Mono';
import { DashedOutline } from './DashedOutline';
import { usePressed } from '../../hooks/usePressed';
import { colors, radii, spacing, typography } from '../../config/theme';
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
  const { pressed, pressHandlers } = usePressed();
  const locked = state === 'locked';
  const active = state === 'active';
  const completed = state === 'completed';
  // The violet milestone treatment only applies while the row is still out of
  // reach; an active or finished review reads by its own state.
  const milestoneLocked = locked && isMilestone;

  const indexColor = completed
    ? colors.success.base
    : active
      ? colors.indigo[300]
      : milestoneLocked
        ? colors.premium.base
        : colors.text.tertiary;

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
        completed && styles.rowCompleted,
        active && styles.rowActive,
        active && styles.rowActiveTall,
        pressed && !locked && styles.rowPressed,
      ]}
    >
      {locked && (
        <DashedOutline
          radius={ROW_RADIUS}
          color={milestoneLocked ? colors.premium.border : colors.border.default}
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
          <Mono size={11} color={colors.text.tertiary} style={styles.activeMeta}>
            {`${xpReward} XP · ${estimatedMinutes} MIN`}
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
  if (state === 'completed') {
    return <View style={styles.dot} />;
  }
  if (state === 'active') {
    // Drawn rather than iconed: a CSS-style border triangle keeps the same
    // optical weight as the 10px dot and rhombus beside it, which Ionicons'
    // `play` glyph does not at this size.
    return <View style={styles.triangle} />;
  }
  return (
    <View
      style={[
        styles.rhombus,
        milestoneLocked && { backgroundColor: colors.premium.base },
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
  if (state === 'active') {
    // A View, not a nested Pressable: the whole row is the target, and a
    // second touchable here would split it into two accessibility nodes.
    return (
      <View style={styles.goPill}>
        <Body size="sm" weight="extrabold" tone="onPrimary" style={styles.goLabel}>
          GO
        </Body>
      </View>
    );
  }

  if (state === 'completed') {
    return (
      <Mono size={11} medium color={colors.success.base}>
        {score === null ? 'DONE' : `${Math.round(score * 100)}%`}
      </Mono>
    );
  }

  if (milestoneLocked) {
    return (
      <Mono size={11} medium color={colors.premium.base}>
        MILESTONE
      </Mono>
    );
  }

  return (
    <Mono size={11} color={colors.text.tertiary}>
      {`+${xpReward} XP`}
    </Mono>
  );
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
    parts.push('next up', `${xpReward} XP`, `${estimatedMinutes} minutes`);
  } else {
    parts.push('locked', `${xpReward} XP`);
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
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: ROW_RADIUS,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowCompleted: {
    backgroundColor: colors.surface.card,
  },
  rowActive: {
    backgroundColor: colors.action.primaryTint,
    borderColor: colors.action.primaryBorder,
  },
  rowActiveTall: {
    minHeight: 84,
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
    backgroundColor: colors.success.base,
  },
  triangle: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.indigo[300],
    // Optical centering — a triangle's visual mass sits left of its box.
    marginLeft: 2,
  },
  rhombus: {
    width: 10,
    height: 10,
    backgroundColor: colors.text.quaternary,
    transform: [{ rotate: '45deg' }],
  },
  goPill: {
    minWidth: 62,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.action.primaryFill,
  },
  goLabel: {
    letterSpacing: typography.tracking.cta,
  },
});
