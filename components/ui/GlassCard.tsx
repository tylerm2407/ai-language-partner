import React from 'react';
import {
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type AccessibilityRole,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { haptic } from '../../lib/haptics';
import { useUi2Theme, type Ui2Theme } from '../../hooks/useUi2Theme';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GlassVariant = 'subtle' | 'default' | 'elevated';

interface VariantConfig {
  fillColor: string;
  borderWidth: number;
  borderBottomWidth: number;
  borderColor: string;
  highlightColor: string;
  highlightOpacity: number;
  shadowOpacity: number;
  shadowRadius: number;
}

export interface GlassCardProps {
  children: ReactNode;
  variant?: GlassVariant;
  borderRadius?: number;
  highlightOpacity?: number;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  pressable?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
}

// ---------------------------------------------------------------------------
// Variant presets — UI 2.0 slabs.
//
// The three variants used to differ by fill ALPHA (0.25 / 0.35 / 0.45), which
// only worked over a busy video background; then, under Dark Glow, by surface
// step and border weight. Under UI 2.0 they differ by GROUND and EDGE: `subtle`
// sits flush (border-weight bottom edge, no slab), `default` is the standard
// slab card, `elevated` takes the second ground step under the same slab.
//
// The press flash is a `primaryTint` wash rather than the old white sheen. A
// white overlay is invisible on a white card, which is exactly the light-mode
// failure this migration exists to remove; the accent tint reads in both
// schemes. `highlightOpacity` is retained in the API (and still drives that
// flash) so call sites keep compiling.
// ---------------------------------------------------------------------------

const variantConfig = (
  c: Ui2Theme['c'],
  shape: Ui2Theme['shape'],
): Record<GlassVariant, VariantConfig> => ({
    subtle: {
      fillColor: c.card,
      borderWidth: shape.border,
      borderBottomWidth: shape.border,
      borderColor: c.cardBorder,
      highlightColor: c.primaryTint,
      highlightOpacity: 0,
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    default: {
      fillColor: c.card,
      borderWidth: shape.border,
      borderBottomWidth: shape.slab,
      borderColor: c.cardBorder,
      highlightColor: c.primaryTint,
      highlightOpacity: 0,
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    elevated: {
      fillColor: c.surface2,
      borderWidth: shape.border,
      borderBottomWidth: shape.slab,
      borderColor: c.primaryTintBorder,
      highlightColor: c.primaryTint,
      highlightOpacity: 0,
      shadowOpacity: 0,
      shadowRadius: 0,
    },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GlassCard({
  children,
  variant = 'default',
  borderRadius = 18,
  highlightOpacity,
  style,
  innerStyle,
  pressable = false,
  onPress,
  accessibilityLabel,
  accessibilityRole,
}: GlassCardProps) {
  const { c, shape } = useUi2Theme();
  const cfg = variantConfig(c, shape)[variant];
  const highlight = highlightOpacity ?? cfg.highlightOpacity;

  // --- Press animation (Reanimated) ---
  const pressed = useSharedValue(0);

  const animatedScale = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));

  const animatedHighlight = useAnimatedStyle(() => ({
    opacity: highlight + pressed.value * 0.08,
  }));

  const fireOnPress = () => {
    onPress?.();
    haptic('select');
  };

  const tap = Gesture.Tap()
    .onBegin(() => {
      pressed.value = withTiming(1, { duration: 100 });
    })
    .onFinalize((_e, success) => {
      pressed.value = withTiming(0, { duration: 200 });
      if (success && onPress) {
        runOnJS(fireOnPress)();
      }
    });

  // --- Shadow style (elevated only) ---
  const shadowStyle: ViewStyle =
    cfg.shadowOpacity > 0
      ? {
          shadowColor: cfg.borderColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: cfg.shadowOpacity,
          shadowRadius: cfg.shadowRadius,
          elevation: 6,
        }
      : {};

  // --- Render ---
  const card = (
    <Animated.View
      style={[{ borderRadius, overflow: 'hidden' }, shadowStyle, style, pressable && animatedScale]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole ?? (pressable ? 'button' : undefined)}
    >
      {/* Layer 1 — fill + border */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: cfg.fillColor,
            borderRadius,
            borderWidth: cfg.borderWidth,
            borderBottomWidth: cfg.borderBottomWidth,
            borderColor: cfg.borderColor,
          },
        ]}
        pointerEvents="none"
      />

      {/* Layer 2 — press-state flash only. At rest this is fully transparent
          (every variant's highlightOpacity is 0); it lights up briefly on tap
          to replace the scale-only press feedback the sheen used to provide. */}
      {pressable && (
        <Animated.View style={[StyleSheet.absoluteFill, animatedHighlight]} pointerEvents="none">
          <LinearGradient
            colors={[cfg.highlightColor, 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.4 }}
            style={[StyleSheet.absoluteFill, { borderRadius }]}
          />
        </Animated.View>
      )}

      {/* Content */}
      <View style={innerStyle}>{children}</View>
    </Animated.View>
  );

  if (pressable) {
    return <GestureDetector gesture={tap}>{card}</GestureDetector>;
  }

  return card;
}
