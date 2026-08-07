/**
 * TactileButton — the canonical CTA primitive.
 *
 * Visual: FLAT. A single filled pill with an optional hairline border. On press
 * it scales to 0.96 and drops to 90% opacity, paired with a light haptic.
 *
 * This used to be a Duolingo-style "slab" button — the fill sitting on a darker
 * bottom edge that collapsed on press. That slab was the single strongest
 * visual tell tying the app to Duolingo, and it is retired under Studio
 * Graphite (DESIGN.md §What We Retired). The name and the whole prop surface
 * are unchanged so no call site had to move.
 *
 * Variants:
 *   primary   — brass fill, DARK label. Default CTA.
 *   secondary — surface-card fill, hairline border. "Cancel" / "Skip".
 *   danger    — error.dark fill, light label. Destructive / exit.
 *   ghost     — transparent fill, brass label only. Tertiary actions.
 *
 * Haptic + press animation both honor useMotion.shouldReduce.
 */

import React, { useRef } from 'react';
import { Pressable, Animated, View, type ViewStyle, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radii, spacing, typography } from '../../config/theme';
import { useMotion } from '../../hooks/useMotion';
import { Body } from './Text';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface TactileButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
  fullWidth?: boolean;
}

const STYLES = {
  primary: {
    // Brass is a LIGHT fill — the label is near-black (7.9:1). White here is
    // 2.4:1 and was the failure mode the old indigo palette had inverted.
    fill: colors.action.primaryFill,
    text: colors.text.onPrimary,
    borderColor: 'transparent',
    borderWidth: 0,
  },
  secondary: {
    fill: colors.surface.card,
    text: colors.text.primary,
    borderColor: colors.border.default,
    borderWidth: 1,
  },
  danger: {
    // error.dark, not error.base: the label is 17px bold, which is under the
    // 14pt threshold for "large text", so it needs the full 4.5:1. On
    // error.base that lands at 3.9:1; on error.dark it is 5.5:1.
    fill: colors.error.dark,
    text: colors.text.primary,
    borderColor: 'transparent',
    borderWidth: 0,
  },
  ghost: {
    fill: 'transparent',
    text: colors.action.accent,
    borderColor: 'transparent',
    borderWidth: 0,
  },
} as const;

const PRESS_SCALE = 0.96;

export function TactileButton({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  leftIcon,
  style,
  accessibilityLabel,
  fullWidth = true,
}: TactileButtonProps) {
  const palette = STYLES[variant];
  const scale = useRef(new Animated.Value(1)).current;
  const { shouldReduce, duration } = useMotion();

  const paddingHorizontal = spacing.xl;
  const paddingVertical = size === 'lg' ? spacing.md : spacing.sm;
  const height = size === 'lg' ? 56 : 44;

  const handlePressIn = () => {
    if (disabled || loading) return;
    if (!shouldReduce) {
      Animated.timing(scale, {
        toValue: PRESS_SCALE,
        duration: duration.instant,
        useNativeDriver: true,
      }).start();
    }
    // Light haptic always (does not depend on motion pref)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    if (!shouldReduce) {
      Animated.timing(scale, {
        toValue: 1,
        duration: duration.instant,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePress = () => {
    if (disabled || loading) return;
    onPress?.();
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={[styles.wrapper, fullWidth ? styles.fullWidth : undefined, style]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: palette.fill,
            borderColor: palette.borderColor,
            borderWidth: palette.borderWidth,
            borderRadius: radii.lg,
            height,
            paddingHorizontal,
            paddingVertical,
            transform: [{ scale }],
            opacity: isDisabled ? 0.45 : 1,
          },
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        {/* CTA labels are uppercase + tracked, the deck's button voice. Weight
            is extrabold: Nunito's rounded terminals read lighter than Inter at
            the same numeric weight, so semibold looked underset on a fill. */}
        <Body
          size="lg"
          weight="extrabold"
          style={{
            color: palette.text,
            fontSize: typography.scale.bodyLg.fontSize,
            lineHeight: typography.scale.bodyLg.lineHeight,
            letterSpacing: typography.tracking.cta,
            textTransform: 'uppercase',
          }}
        >
          {loading ? 'Loading…' : label}
        </Body>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  fill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftIcon: {
    marginRight: spacing.xs,
  },
});
