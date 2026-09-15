/**
 * TactileButton — the canonical CTA primitive.
 *
 * Visual: FLAT. A single filled pill with an optional hairline border. On press
 * it scales to 0.96 and drops to 90% opacity, paired with a light haptic.
 *
 * This used to be a Duolingo-style "slab" button — the fill sitting on a darker
 * bottom edge that collapsed on press. That slab was the single strongest
 * visual tell tying the app to Duolingo, and it stays retired (DESIGN.md
 * §What We Retired). The name and the whole prop surface are unchanged so no
 * call site had to move.
 *
 * Variants:
 *   primary   — `primary` fill, `onPrimary` label. Default CTA.
 *   secondary — `card` fill, `cardBorder` border. "Cancel" / "Skip".
 *   danger    — `error` fill, ground-coloured label. Destructive / exit.
 *   ghost     — transparent fill, `onTint` label only. Tertiary actions.
 *
 * Colour comes from `useUi2Theme()` — see `variantPalette` below. Nothing here
 * reads the fixed dark `colors` palette, because this primitive is rendered
 * inside screens that already follow the phone's light/dark setting.
 *
 * Haptic + press animation both honor useMotion.shouldReduce.
 */

import React, { useRef } from 'react';
import { Pressable, Animated, View, type ViewStyle, StyleSheet } from 'react-native';
import { haptic } from '../../lib/haptics';
import { radii, spacing, typography, ui2Shape, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
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

interface VariantPalette {
  fill: string;
  text: string;
  borderColor: string;
  borderWidth: number;
}

/**
 * The variant table, resolved against the scheme-aware palette.
 *
 * An arrow const rather than a `function` so it stays a plain value from the
 * module's point of view, and pure so the table can be asserted without a
 * render harness — same shape as `badgeColors` in components/ui2/Ui2Badge.tsx.
 *
 * `danger` is the one entry the UI 2.0 palette cannot make AA-clean in both
 * schemes. `error` is a DARK red in light mode and a LIGHT red in dark mode, so
 * the readable label is the page ground in each: `c.bg` is white on the light
 * fill (3.9:1) and near-black on the dark one (6.8:1). White in both, which is
 * what this variant used to do, would be 2.8:1 in dark — strictly worse. There
 * is no darker red in the palette to reach 4.5:1 in light; the variant has no
 * call sites today, and the fix if it gains one is a tinted danger button
 * (`pinkTint` fill + `ink` label), which is the answer Ui2Badge already took.
 */
const variantPalette = (c: Ui2Palette): Record<Variant, VariantPalette> => ({
  primary: {
    // White on `primary` is 5.6:1 light / 4.6:1 dark — both clear AA, which is
    // why the palette picks a primary one step darker than the design boards'.
    fill: c.primary,
    text: c.onPrimary,
    borderColor: 'transparent',
    borderWidth: 0,
  },
  secondary: {
    fill: c.card,
    text: c.ink,
    borderColor: c.cardBorder,
    borderWidth: ui2Shape.border,
  },
  danger: {
    fill: c.error,
    text: c.bg,
    borderColor: 'transparent',
    borderWidth: 0,
  },
  ghost: {
    fill: 'transparent',
    text: c.onTint,
    borderColor: 'transparent',
    borderWidth: 0,
  },
});

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
  const { c } = useUi2Theme();
  const palette = variantPalette(c)[variant];
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
    // Light haptic always (does not depend on the motion preference — they
    // are separate switches, see lib/haptics.ts).
    haptic('buttonPress');
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
