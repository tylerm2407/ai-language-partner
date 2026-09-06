/**
 * SlabButton — the UI 2.0 primary action. A filled block with a thicker bottom
 * edge; pressing sinks the block into the edge (translateY + thinner slab), so
 * the button reads as a physical key. The haptic fires on the way down, the
 * `onPress` on release, like the rest of the app.
 */
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';

type Variant = 'primary' | 'onPrimary' | 'ghost';

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

  const sink = shape.buttonSlab - shape.slabPressed;
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * sink }],
    borderBottomWidth: shape.buttonSlab - pressed.value * sink,
  }));

  const fill =
    variant === 'primary'
      ? { bg: c.primary, slab: c.slab, text: c.onPrimary }
      : variant === 'onPrimary'
        ? { bg: c.ctaOnPrimaryBg, slab: c.ctaOnPrimarySlab, text: c.ctaOnPrimaryText }
        : { bg: 'transparent', slab: 'transparent', text: c.muted };
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
      {/* The slab lives in a wrapper so the sink does not shift the label. */}
      <View style={{ paddingBottom: shape.buttonSlab }}>
        <Animated.View
          style={[
            styles.block,
            {
              backgroundColor: fill.bg,
              borderBottomColor: fill.slab,
              borderRadius: shape.radiusButton,
              opacity: inactive ? 0.6 : 1,
              marginBottom: -shape.buttonSlab,
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
      </View>
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
