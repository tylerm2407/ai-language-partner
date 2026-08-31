/**
 * The two pill rows at the top of the Learn screen.
 *
 * `CoursePills` picks the CEFR course; `TabPills` picks Vocab / Reading /
 * Writing. They share one pill so the rows read as one control stack rather
 * than two components that happen to look similar.
 *
 * The selected course pill spells out the full course title ("Spanish A1")
 * while the rest show only their level ("A2"). The language never changes
 * inside this row — every course here is for the learner's target language —
 * so repeating it four times spends width on nothing, but dropping it entirely
 * would leave the screen without ever naming what is being learned.
 *
 * A 56pt pill cannot carry a can-do sentence, so the codes stay bare here and
 * the meaning is carried twice instead: VoiceOver gets it from every pill's
 * label, and the caption under the row states it for the selected course. A row
 * of letter codes with nothing explaining them is exactly what this pass exists
 * to remove.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Body, Caption } from '../ui/Text';
import { usePressed } from '../../hooks/usePressed';
import { cefrCanDo, cefrAccessibilityLabel } from '../../lib/cefr-labels';
import { colors, radii, spacing } from '../../config/theme';
import type { Course } from '../../types';

interface PillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityRole: 'button' | 'tab';
}

function Pill({ label, selected, onPress, accessibilityLabel, accessibilityRole }: PillProps) {
  const { pressed, pressHandlers } = usePressed();
  return (
    <Pressable
      onPress={onPress}
      {...pressHandlers}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={[
        styles.pill,
        selected ? styles.pillSelected : styles.pillIdle,
        pressed && styles.pillPressed,
      ]}
    >
      <Body
        size="sm"
        weight="extrabold"
        tone={selected ? 'onPrimary' : 'tertiary'}
        numberOfLines={1}
      >
        {label}
      </Body>
    </Pressable>
  );
}

// ─── Course row ───────────────────────────────────────────────────────────

interface CoursePillsProps {
  courses: Course[];
  selectedCourseId: string | null;
  onSelect: (courseId: string) => void;
}

export function CoursePills({ courses, selectedCourseId, onSelect }: CoursePillsProps) {
  if (courses.length === 0) return null;

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const canDo = cefrCanDo(selectedCourse?.cefrLevel);

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.courseRow}
      >
        {courses.map((course) => {
          const selected = course.id === selectedCourseId;
          return (
            <Pill
              key={course.id}
              label={selected ? course.title : course.cefrLevel}
              selected={selected}
              onPress={() => onSelect(course.id)}
              accessibilityLabel={`${course.title}. ${cefrAccessibilityLabel(course.cefrLevel)}`}
              accessibilityRole="button"
            />
          );
        })}
      </ScrollView>

      {canDo ? (
        <Caption size="sm" tone="tertiary" style={styles.courseCaption}>
          {canDo}
        </Caption>
      ) : null}
    </View>
  );
}

// ─── Tab row ──────────────────────────────────────────────────────────────

interface TabPillsProps<T extends string> {
  tabs: { key: T; label: string }[];
  activeKey: T;
  onSelect: (key: T) => void;
}

export function TabPills<T extends string>({ tabs, activeKey, onSelect }: TabPillsProps<T>) {
  return (
    <View style={styles.tabRow} accessibilityRole="tablist">
      {tabs.map((tab) => (
        <Pill
          key={tab.key}
          label={tab.label}
          selected={tab.key === activeKey}
          onPress={() => onSelect(tab.key)}
          accessibilityLabel={tab.label}
          accessibilityRole="tab"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Both rows pad themselves so the course strip can scroll edge to edge
  // while its first pill still lines up with the screen's gutter.
  courseRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  /** Aligns with the scrolling row's first pill rather than the screen edge. */
  courseCaption: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  pill: {
    // 44pt Apple HIG minimum.
    minHeight: 44,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  pillIdle: {
    backgroundColor: colors.surface.card,
    borderColor: colors.border.subtle,
  },
  pillSelected: {
    backgroundColor: colors.action.primaryFill,
    borderColor: colors.action.primaryFill,
  },
  pillPressed: {
    opacity: 0.8,
  },
});
