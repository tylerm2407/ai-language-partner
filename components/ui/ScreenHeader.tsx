/**
 * ScreenHeader — consistent top-of-screen title bar across all screens.
 *
 * Replaces ad-hoc `<View className="flex-row">...<Text>Title</Text>` blocks.
 * Back button is rendered automatically when `onBack` is provided.
 */

import React from 'react';
import { View, Pressable, type ViewStyle, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../config/theme';
import { Body, Heading } from './Text';

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** Visually centered title (defaults to left-aligned). */
  centered?: boolean;
  style?: ViewStyle;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  centered = false,
  style,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}

        <View
          style={[
            styles.titleArea,
            centered ? { alignItems: 'center' } : { alignItems: 'flex-start' },
          ]}
        >
          {title && <Heading level={2}>{title}</Heading>}
          {subtitle && (
            <Body size="sm" tone="secondary" style={{ marginTop: 2 }}>
              {subtitle}
            </Body>
          )}
        </View>

        <View style={styles.rightArea}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  titleArea: {
    flex: 1,
    justifyContent: 'center',
  },
  rightArea: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
});
