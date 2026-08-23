/**
 * UnitPath — the Vocab tab: a unit carousel over the selected unit's lessons.
 *
 * This replaced the winding "snake" path. The path rendered every lesson in
 * the course as an absolutely-positioned node on one tall canvas, which meant
 * a learner on unit 6 scrolled past ~30 nodes to reach their next lesson and
 * had no way to see a unit's shape without scrolling through it. A carousel of
 * units over a flat list of that unit's lessons puts the next lesson one
 * screen from the top at any point in the course, and makes each lesson's
 * title, reward and score readable — none of which fit on a 64px node.
 *
 * Progress comes from `useLessonProgress`; all derivation is in
 * lib/learn-progress.ts so the rollups are unit-testable.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useLessonProgress } from '../../hooks/useLessonProgress';
import { Body, Heading } from '../ui/Text';
import { Button } from '../ui/Button';
import { Mono } from './Mono';
import { UnitCarousel } from './UnitCarousel';
import { LessonRow } from './LessonRow';
import {
  buildUnitProgress,
  findFocusUnitIndex,
  isMilestoneLesson,
  toPercent,
  type UnitWithLessons,
} from '../../lib/learn-progress';
import { colors, spacing } from '../../config/theme';

interface UnitPathProps {
  units: UnitWithLessons[];
  courseId: string;
  /** Rendered above the unit strip — the review-cards shortcut. */
  header?: React.ReactNode;
}

export function UnitPath({ units, courseId, header }: UnitPathProps) {
  const router = useRouter();
  const { getLessonState, getScore, loading, error, retry } = useLessonProgress(courseId);

  const unitProgress = useMemo(
    () => (loading ? [] : buildUnitProgress(units, getLessonState, getScore)),
    [units, getLessonState, getScore, loading],
  );

  const focusIndex = useMemo(() => findFocusUnitIndex(unitProgress), [unitProgress]);

  // `null` until progress lands, so the first render lands on the learner's
  // real position instead of snapping from unit 1 a beat later. After that the
  // selection is the learner's, and reloading progress must not yank it.
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  useEffect(() => {
    if (!loading && chosenIndex === null && unitProgress.length > 0) {
      setChosenIndex(focusIndex);
    }
  }, [loading, chosenIndex, focusIndex, unitProgress.length]);

  // Switching course remounts nothing, so drop a stale selection explicitly.
  useEffect(() => {
    setChosenIndex(null);
  }, [courseId]);

  // Progress failed to load — without it every lesson would render locked,
  // which is indistinguishable from real state. Surface the failure instead.
  if (error) {
    return (
      <View style={styles.centered}>
        <Body size="lg" tone="secondary" style={styles.centeredText}>
          Couldn't load your progress. Check your connection and try again.
        </Body>
        <Button label="Try Again" variant="primary" onPress={retry} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.action.accent} />
        <Body size="sm" tone="tertiary" style={styles.loadingText}>
          Loading your progress…
        </Body>
      </View>
    );
  }

  if (unitProgress.length === 0) {
    return (
      <View style={styles.centered}>
        <Body size="lg" tone="secondary" style={styles.centeredText}>
          This course has no units yet. Check back soon.
        </Body>
      </View>
    );
  }

  const selectedIndex = Math.min(chosenIndex ?? focusIndex, unitProgress.length - 1);
  const selected = unitProgress[selectedIndex];
  const totalLessons = unitProgress.reduce((sum, u) => sum + u.totalCount, 0);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {header && <View style={styles.header}>{header}</View>}

      <View style={styles.eyebrowRow}>
        <Mono size={12} medium>
          {`${unitProgress.length} UNITS · ${totalLessons} LESSONS`}
        </Mono>
        {unitProgress.length > 1 && (
          <Mono size={12} color={colors.text.tertiary}>
            SWIPE →
          </Mono>
        )}
      </View>

      <UnitCarousel
        units={unitProgress}
        selectedIndex={selectedIndex}
        onSelect={setChosenIndex}
      />

      <View style={styles.listHeader}>
        <Heading level={2} style={styles.listTitle}>
          {`Unit ${selected.index + 1} lessons`}
        </Heading>
        <Mono
          size={12}
          medium
          color={selected.mastery > 0 ? colors.indigo[300] : colors.text.tertiary}
          accessibilityLabel={`${toPercent(selected.mastery)} percent of this unit mastered`}
        >
          {`${toPercent(selected.mastery)}% MASTERED`}
        </Mono>
      </View>

      <View style={styles.list}>
        {selected.lessons.map((lesson, i) => (
          <LessonRow
            key={lesson.id}
            position={i + 1}
            title={lesson.title}
            state={selected.lessonStates[i]}
            isMilestone={isMilestoneLesson(i, selected.totalCount)}
            score={selected.lessonScores[i]}
            xpReward={lesson.xpReward}
            estimatedMinutes={lesson.estimatedMinutes}
            onPress={() => router.push(`/learn/${lesson.id}` as never)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    paddingBottom: 120, // clears the tab bar
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  centeredText: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.md,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  listTitle: {
    flexShrink: 1,
    paddingRight: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.md,
  },
});
