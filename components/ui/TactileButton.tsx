/**
 * TactileButton — the canonical CTA primitive.
 *
 * Visual: Duolingo-style "slab" button — the fill color sits on top of a
 * darker bottom edge (the slab); on press, the fill translates down ~3px
 * so the slab collapses, simulating a physical click. Paired with a light
 * haptic on press.
 *
 * Variants:
 *   primary   — indigo fill, indigo-700 slab. Default CTA.
 *   secondary — surface-card fill, hairline border. "Cancel" / "Skip".
 *   danger    — red fill, red-dark slab. Destructive / exit.
 *   ghost     — transparent fill, indigo label only. Tertiary actions.
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
    fill: colors.indigo[500],
    slab: colors.indigo[700],
    text: colors.text.onPrimary,
    borderColor: 'transparent',
  },
  secondary: {
    fill: colors.surface.card,
    slab: colors.surface.cardAlt,
    text: colors.text.primary,
    borderColor: colors.border.default,
  },
  danger: {
    fill: colors.error.base,
    slab: colors.error.dark,
    text: colors.text.onPrimary,
    borderColor: 'transparent',
  },
  ghost: {
    fill: 'transparent',
    slab: 'transparent',
    text: colors.indigo[400],
    borderColor: 'transparent',
  },
} as const;

const SLAB_HEIGHT = 4;

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
  const translateY = useRef(new Animated.Value(0)).current;
  const { shouldReduce, duration } = useMotion();

  const isGhost = variant === 'ghost';
  const paddingVertical = size === 'lg' ? spacing.md : spacing.sm;
  const paddingHorizontal = spacing.xl;
  const height = size === 'lg' ? 56 : 44;

  const handlePressIn = () => {
    if (disabled || loading) return;
    if (!shouldReduce) {
      Animated.timing(translateY, {
        toValue: SLAB_HEIGHT,
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
      Animated.timing(translateY, {
        toValue: 0,
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
      style={[
        styles.wrapper,
        fullWidth ? styles.fullWidth : undefined,
        style,
      ]}
    >
      {/* Slab (bottom edge). Invisible on ghost. */}
      {!isGhost && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: palette.slab,
              borderRadius: radii.lg,
              opacity: isDisabled ? 0.4 : 1,
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Fill (top surface, translates down on press) */}
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: palette.fill,
            borderColor: palette.borderColor,
            borderWidth: isGhost ? 0 : variant === 'secondary' ? 1 : 0,
            borderRadius: radii.lg,
            height,
            paddingHorizontal,
            paddingVertical,
            transform: [{ translateY }],
            opacity: isDisabled ? 0.5 : 1,
            marginBottom: isGhost ? 0 : SLAB_HEIGHT,
          },
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <Body
          size="lg"
          weight="semibold"
          style={{
            color: palette.text,
            fontSize: typography.scale.bodyLg.fontSize,
            lineHeight: typography.scale.bodyLg.lineHeight,
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
    position: 'relative',
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
