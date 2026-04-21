/**
 * Chip — small pill with optional left icon + colored fill.
 *
 * Used for error-type tags (grammar/vocab/etc.), severity labels, league
 * tiers, streak badges, and scenario filters.
 */

import React from 'react';
import { View, Pressable, type ViewStyle, StyleSheet } from 'react-native';
import { Caption } from './Text';
import { colors, radii, spacing } from '../../config/theme';

type Variant =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'error'
  | 'warning'
  | 'premium'
  | 'streak';

interface ChipProps {
  label: string;
  variant?: Variant;
  leftIcon?: React.ReactNode;
  onPress?: () => void;
  /** Use theme.colors.correctionChip keys for correction-banner chips. */
  customColors?: { bg: string; text: string };
  style?: ViewStyle;
}

const VARIANT_STYLES: Record<Variant, { bg: string; text: string }> = {
  neutral: { bg: colors.surface.cardAlt, text: colors.text.secondary },
  primary: { bg: 'rgba(99, 102, 241, 0.22)', text: colors.indigo[300] },
  success: { bg: colors.success.tint, text: colors.success.light },
  error: { bg: colors.error.tint, text: colors.error.light },
  warning: { bg: colors.warning.tint, text: colors.warning.light },
  premium: { bg: colors.premium.tint, text: colors.premium.base },
  streak: { bg: colors.streak.tint, text: colors.streak.base },
};

export function Chip({ label, variant = 'neutral', leftIcon, onPress, customColors, style }: ChipProps) {
  const palette = customColors ?? VARIANT_STYLES[variant];

  const content = (
    <>
      {leftIcon && <View style={styles.icon}>{leftIcon}</View>}
      <Caption size="sm" style={{ color: palette.text, fontWeight: '700', letterSpacing: 0.4 }}>
        {label}
      </Caption>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={[styles.chip, { backgroundColor: palette.bg }, style]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.chip, { backgroundColor: palette.bg }, style]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
});
