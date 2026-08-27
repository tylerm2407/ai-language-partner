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
import { GLASS_HIGHLIGHT } from '../../config/gradients';
import { colors } from '../../config/theme';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GlassVariant = 'subtle' | 'default' | 'elevated';

interface VariantConfig {
  fillColor: string;
  borderWidth: number;
  borderColor: string;
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
// Variant presets — opaque under the Dark Glow theme.
//
// The three variants used to differ by fill ALPHA (0.25 / 0.35 / 0.45), which
// only worked over a busy video background. Now they differ by surface step and
// border weight: subtle sits flush, default is the standard card, elevated
// borrows border.strong. Sheen and drop shadows are gone — the deck is flat and
// depth comes from the glow layer. `highlightOpacity` is retained in the API
// (and used for the press-state flash) so call sites keep compiling.
// ---------------------------------------------------------------------------

const VARIANTS: Record<GlassVariant, VariantConfig> = {
  subtle: {
    fillColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    highlightOpacity: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  default: {
    fillColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    highlightOpacity: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  elevated: {
    fillColor: colors.surface.cardAlt,
    borderWidth: 1,
    borderColor: colors.border.strong,
    highlightOpacity: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
};

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
  const cfg = VARIANTS[variant];
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
          shadowColor: '#000',
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
      {/* Layer 1 — Translucent fill + border */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: cfg.fillColor,
            borderRadius,
            borderWidth: cfg.borderWidth,
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
            colors={[...GLASS_HIGHLIGHT]}
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
