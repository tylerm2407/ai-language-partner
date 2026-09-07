/**
 * Chip — small pill with optional left icon + colored fill.
 *
 * Used for error-type tags (grammar/vocab/etc.), severity labels, league
 * tiers, and scenario filters.
 */

import React from 'react';
import { View, Pressable, type ViewStyle, StyleSheet } from 'react-native';
import { Caption } from './Text';
import { radii, spacing, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';

type Variant =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'error'
  | 'warning'
  | 'premium'
;

interface ChipProps {
  label: string;
  variant?: Variant;
  leftIcon?: React.ReactNode;
  onPress?: () => void;
  /** Escape hatch for callers that already resolved a scheme-aware pair. */
  customColors?: { bg: string; text: string };
  style?: ViewStyle;
}

/**
 * The variant table, resolved against the scheme-aware palette. Deliberately
 * the same fills `components/ui2/Chip.tsx` uses: DESIGN.md maps this chip onto
 * that one, screens render both, and a chip whose `success` variant is a
 * different green depending on which import a screen happened to use is a
 * visible inconsistency rather than a theoretical one.
 *
 * `premium` folds onto the primary tint for the same reason it does there:
 * UI 2.0 has one accent, and inventing a second here would put a colour on
 * screen that exists nowhere in the design.
 */
const variantFills = (c: Ui2Palette): Record<Variant, { bg: string; text: string }> => ({
  neutral: { bg: c.surface2, text: c.muted },
  primary: { bg: c.primaryTint, text: c.onTint },
  success: { bg: c.greenTint, text: c.green },
  error: { bg: c.pinkTint, text: c.error },
  warning: { bg: c.yellowTint, text: c.yellow },
  premium: { bg: c.primaryTint, text: c.onTint },
});

export function Chip({ label, variant = 'neutral', leftIcon, onPress, customColors, style }: ChipProps) {
  const { c } = useUi2Theme();
  const palette = customColors ?? variantFills(c)[variant];

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
