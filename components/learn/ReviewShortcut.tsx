/**
 * ReviewShortcut — the "cards are due" row at the top of each Learn tab.
 *
 * Scrolls with the tab content rather than pinning under the pill rows: due
 * cards matter, but not enough to hold ~56pt of a phone screen hostage above
 * the lesson the learner opened this tab to reach. Renders nothing at zero due
 * — an empty review queue is good news, not a row.
 *
 * Carries no horizontal margin of its own; the tab that renders it owns the
 * gutter, because two of the three tabs pad their whole scroll body.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body } from '../ui2/Ui2Text';
import { Mono } from './Mono';
import { usePressed } from '../../hooks/usePressed';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { radii, spacing } from '../../config/theme';

interface ReviewShortcutProps {
  count: number;
  onPress: () => void;
}

export function ReviewShortcut({ count, onPress }: ReviewShortcutProps) {
  const { c } = useUi2Theme();
  const { pressed, pressHandlers } = usePressed();
  if (count <= 0) return null;

  return (
    <Pressable
      onPress={onPress}
      {...pressHandlers}
      accessibilityRole="button"
      accessibilityLabel={`Review cards. ${count} ${count === 1 ? 'card' : 'cards'} due.`}
      style={[styles.row, { borderColor: c.greenBorder, backgroundColor: c.greenTint }, pressed && styles.pressed]}
    >
      <View style={[styles.iconWell, { backgroundColor: c.greenBorder }]}>
        <Ionicons name="refresh" size={18} color={c.green} />
      </View>
      <Body size="md" weight="bold" style={styles.label}>
        Review cards
      </Body>
      <Mono size={11} medium color={c.green}>
        {`${count} DUE`}
      </Mono>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={c.idle}
        style={styles.chevron}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.75,
  },
  iconWell: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  chevron: {
    marginLeft: spacing.xxs,
  },
});
