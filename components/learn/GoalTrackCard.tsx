import { useState } from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../ui2/SlabCard';
import { Body, Caption } from '../ui2/Ui2Text';
import { Mono } from './Mono';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { radii, spacing, typography } from '../../config/theme';
import {
  formatGoalScore,
  goalLessonRowState,
  summarizeGoalTrack,
  type GoalLessonRowState,
  type GoalTrackLesson,
  type GoalTrackProgress,
} from '../../lib/goal-track-progress';

/**
 * The learner's goal track in Learn: the unit generated from their onboarding
 * "picture a moment you'd love to have in this language" answer.
 *
 * Lessons are created as shells and filled in on first open, so a row can be
 * in one of several states and they are NOT interchangeable to a learner:
 *   completed  — done; shows the score, opens again for practice.
 *   next       — the first unfinished lesson: the one tap the card is for.
 *   open       — any other unfinished lesson; ready, or built on tap.
 *   generating — somebody else is building this exact lesson right now.
 *
 * Showing "generating" as a plain disabled row would read as broken. Showing
 * a shell as ready would open an empty lesson. Hence the states.
 *
 * Progress is derived (lib/goal-track-progress.ts) from the learner's completions —
 * a track has no progress table of its own. It is shown as "N OF M DONE" and
 * a bar rather than a percentage, because six lessons is few enough that the
 * count is the more honest number.
 */

interface Props {
  track: GoalTrackProgress;
  /** Resolves true when the lesson has exercises and can be opened. */
  onOpenLesson: (lessonId: string) => Promise<boolean>;
  onNavigate: (lessonId: string) => void;
}

export function GoalTrackCard({ track, onOpenLesson, onNavigate }: Props) {
  const { c } = useUi2Theme();
  const [busyLessonId, setBusyLessonId] = useState<string | null>(null);
  const [failedLessonId, setFailedLessonId] = useState<string | null>(null);
  const summary = summarizeGoalTrack(track.lessons);
  const finished = summary.total > 0 && summary.doneCount === summary.total;

  const handlePress = async (lesson: GoalTrackLesson) => {
    if (busyLessonId) return;
    if (lesson.generationState === 'ready' || lesson.generationState === null) {
      onNavigate(lesson.id);
      return;
    }
    setBusyLessonId(lesson.id);
    setFailedLessonId(null);
    try {
      const ready = await onOpenLesson(lesson.id);
      if (ready) onNavigate(lesson.id);
      else setFailedLessonId(lesson.id);
    } catch {
      setFailedLessonId(lesson.id);
    } finally {
      setBusyLessonId(null);
    }
  };

  return (
    <SlabCard style={styles.card}>
      <View style={styles.eyebrowRow}>
        <Ionicons name="flag-outline" size={16} color={c.primary} />
        <Mono size={12} medium color={c.primary} style={styles.eyebrow}>
          YOUR GOAL
        </Mono>
        <Mono
          size={11}
          medium
          color={finished ? c.green : c.idle}
          accessibilityLabel={`${summary.doneCount} of ${summary.total} lessons done`}
        >
          {`${summary.doneCount} OF ${summary.total} DONE`}
        </Mono>
      </View>

      <Body size="lg" weight="extrabold">
        {track.title}
      </Body>
      <Caption tone="secondary" style={styles.description}>
        {track.description}
      </Caption>

      <View
        style={[styles.track, { backgroundColor: c.trackOnCard }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: summary.total, now: summary.doneCount }}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(summary.progress * 100)}%`,
              backgroundColor: finished ? c.green : c.primary,
            },
          ]}
        />
      </View>

      <View style={styles.list}>
        {track.lessons.map((lesson, index) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            position={index + 1}
            state={goalLessonRowState(lesson, summary.nextLessonId)}
            busy={busyLessonId === lesson.id}
            failed={failedLessonId === lesson.id}
            anyBusy={busyLessonId !== null}
            onPress={() => handlePress(lesson)}
          />
        ))}
      </View>
    </SlabCard>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────

interface LessonRowProps {
  lesson: GoalTrackLesson;
  position: number;
  state: GoalLessonRowState;
  busy: boolean;
  failed: boolean;
  anyBusy: boolean;
  onPress: () => void;
}

function LessonRow({ lesson, position, state, busy, failed, anyBusy, onPress }: LessonRowProps) {
  const { c } = useUi2Theme();
  const completed = state === 'completed';
  const next = state === 'next';
  const blocked = state === 'generating';
  const disabled = blocked || anyBusy;

  const caption = busy
    ? 'Preparing this lesson…'
    : blocked
      ? 'Being prepared — check back in a moment.'
      : failed
        ? "Couldn't prepare this one. Tap to try again."
        : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      accessibilityLabel={buildLabel(lesson, position, state)}
      accessibilityHint={completed ? 'Opens this lesson again for practice.' : undefined}
      style={[
        styles.row,
        next && { backgroundColor: c.primaryTint },
        blocked && styles.rowBlocked,
      ]}
    >
      <View
        style={[
          styles.index,
          { backgroundColor: completed ? c.greenTint : next ? c.primary : c.surface2 },
        ]}
      >
        {completed ? (
          <Ionicons name="checkmark" size={15} color={c.green} />
        ) : (
          <Mono size={11} medium color={next ? c.onPrimary : c.idle}>
            {String(position).padStart(2, '0')}
          </Mono>
        )}
      </View>

      <View style={styles.titleColumn}>
        <Body size="md" weight={next ? 'extrabold' : completed ? 'bold' : 'semibold'} numberOfLines={2}>
          {lesson.title}
        </Body>
        {caption && (
          <Caption tone="secondary" size="sm" style={styles.caption}>
            {caption}
          </Caption>
        )}
      </View>

      {busy ? (
        <ActivityIndicator size="small" color={c.idle} />
      ) : completed ? (
        <Mono size={11} medium color={c.green}>
          {formatGoalScore(lesson.completion?.score ?? null)}
        </Mono>
      ) : next ? (
        // A View, not a nested Pressable: the whole row is the target, and a
        // second touchable would split it into two accessibility nodes.
        <View style={[styles.goPill, { backgroundColor: c.primary }]}>
          <Body size="sm" weight="extrabold" tone="onPrimary" style={styles.goLabel}>
            GO
          </Body>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={c.idle} />
      )}
    </Pressable>
  );
}

function buildLabel(lesson: GoalTrackLesson, position: number, state: GoalLessonRowState): string {
  const parts = [`Lesson ${position}`, lesson.title];
  if (state === 'completed') {
    const score = lesson.completion?.score ?? null;
    parts.push(score === null ? 'completed' : `completed, scored ${Math.round(score * 100)} percent`);
  } else if (state === 'next') {
    parts.push('next up');
  } else if (state === 'generating') {
    parts.push('being prepared, try again shortly');
  } else {
    parts.push(lesson.description);
  }
  return parts.join(', ');
}

// ─── Prompt ───────────────────────────────────────────────────────────────

/**
 * Shown when the learner wrote a goal at onboarding but has no track yet.
 *
 * Building a track is a paid, generative call, so it happens on an explicit
 * tap rather than firing on screen load — a learner should never find out we
 * spent model time because they opened a tab. It doubles as where the feature
 * is advertised.
 */
export function GoalTrackPrompt({
  goalText,
  isBuilding,
  error,
  onBuild,
}: {
  goalText: string;
  isBuilding: boolean;
  error: string | null;
  onBuild: () => void;
}) {
  const { c } = useUi2Theme();
  return (
    <SlabCard style={styles.card}>
      <View style={styles.eyebrowRow}>
        <Ionicons name="flag-outline" size={16} color={c.primary} />
        <Mono size={12} medium color={c.primary} style={styles.eyebrow}>
          YOUR GOAL
        </Mono>
      </View>

      <Body size="md" weight="semibold">
        {`“${goalText}”`}
      </Body>
      <Caption tone="secondary" style={styles.description}>
        We can build a short set of lessons aimed straight at that.
      </Caption>

      {error && (
        <Caption tone="secondary" style={styles.description}>
          {error}
        </Caption>
      )}

      <Pressable
        onPress={onBuild}
        disabled={isBuilding}
        style={[styles.build, { backgroundColor: c.primary }, isBuilding && styles.buildBusy]}
        accessibilityRole="button"
        accessibilityState={{ disabled: isBuilding, busy: isBuilding }}
        accessibilityLabel="Build lessons for my goal"
      >
        {isBuilding ? (
          <ActivityIndicator size="small" color={c.onPrimary} />
        ) : (
          <Body size="md" weight="extrabold" tone="onPrimary">
            Build my lessons
          </Body>
        )}
      </Pressable>
    </SlabCard>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  eyebrow: {
    flex: 1,
    marginLeft: spacing.xxs,
  },
  description: {
    marginTop: spacing.xxs,
  },
  track: {
    height: 6,
    borderRadius: 3,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  list: {
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    marginBottom: 2,
  },
  rowBlocked: {
    opacity: 0.6,
  },
  index: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  titleColumn: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  caption: {
    marginTop: 2,
  },
  goPill: {
    minWidth: 56,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  goLabel: {
    letterSpacing: typography.tracking.cta,
  },
  build: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildBusy: {
    opacity: 0.7,
  },
});
