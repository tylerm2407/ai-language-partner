/**
 * SlabButton — the UI 2.0 primary action. A filled pill; pressing scales it to
 * 0.97 on a spring. The haptic fires on the way down, the `onPress` on
 * release, like the rest of the app.
 *
 * The name is historical: until 2026-09-07 this was a block on a 6px bottom
 * slab that sank on press. The slab was the strongest single Duolingo tell in
 * the app and went with the Tint blocks pass (DESIGN.md "UI 2.0 › Shape and
 * type"); the component name stayed so 30-odd call sites did not churn.
 */
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';

/** `tint` is the quiet filled pill — a card-coloured block, muted label — for a
 *  secondary action that still needs a target (Previous beside Next). */
/** `brand` is the logo-cyan pill with navy type — the Home hero's Start (S1 · Quiet, 2026-09-10). */
type Variant = 'primary' | 'onPrimary' | 'ghost' | 'tint' | 'brand';

interface SlabButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Trailing chevron. Off for terminal actions ("Skip", "Save"). */
  arrow?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

const PRESS_SPRING = { damping: 18, stiffness: 320, mass: 0.6 };
/** How far the pill shrinks at full press (1 - scale). */
const PRESS_SCALE = 0.03;

export function SlabButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  arrow = true,
  style,
  accessibilityHint,
}: SlabButtonProps) {
  const { c, type, shape } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const pressed = useSharedValue(0);

  const onPressIn = useCallback(() => {
    haptic('buttonPress');
    pressed.value = shouldReduce ? 1 : withSpring(1, PRESS_SPRING);
  }, [pressed, shouldReduce]);
  const onPressOut = useCallback(() => {
    pressed.value = shouldReduce ? 0 : withSpring(0, PRESS_SPRING);
  }, [pressed, shouldReduce]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * PRESS_SCALE }],
  }));

  const fill =
    variant === 'primary'
      ? { bg: c.primary, text: c.onPrimary }
      : variant === 'onPrimary'
        ? { bg: c.ctaOnPrimaryBg, text: c.ctaOnPrimaryText }
        : variant === 'tint'
          ? { bg: c.card, text: c.muted }
          : variant === 'brand'
            ? { bg: c.logoAqua, text: c.onLogo }
            : { bg: 'transparent', text: c.muted };
  const inactive = disabled || loading;

  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={onPress}
        disabled={inactive}
        style={[styles.ghost, style]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!inactive }}
      >
        <Text style={{ fontFamily: type.uiHeavy, fontSize: 15, color: fill.text }}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={style}
    >
      <Animated.View
        style={[
          styles.block,
          {
            backgroundColor: fill.bg,
            borderRadius: shape.radiusButton,
            opacity: inactive ? 0.6 : 1,
          },
          animated,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fill.text} />
        ) : (
          <View style={styles.labelRow}>
            <Text style={{ fontFamily: type.uiHeavy, fontSize: 16, color: fill.text, letterSpacing: 0.2 }}>
              {label}
            </Text>
            {arrow && <Ionicons name="chevron-forward" size={18} color={fill.text} />}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghost: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
