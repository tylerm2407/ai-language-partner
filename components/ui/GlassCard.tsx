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
import * as Haptics from 'expo-haptics';
import { GLASS_BG, GLASS_HIGHLIGHT, GLASS_BORDER } from '../../config/gradients';
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
// Variant presets — tuned for dark cosmic / galaxy backgrounds
// ---------------------------------------------------------------------------

const VARIANTS: Record<GlassVariant, VariantConfig> = {
  subtle: {
    fillColor: 'rgba(21, 25, 33, 0.25)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    highlightOpacity: 0.06,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  default: {
    fillColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    highlightOpacity: 0.10,
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  elevated: {
    fillColor: 'rgba(21, 25, 33, 0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    highlightOpacity: 0.16,
    shadowOpacity: 0.25,
    shadowRadius: 20,
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
    Haptics.selectionAsync();
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

      {/* Layer 2 — Specular highlight sheen */}
      <Animated.View
        style={[StyleSheet.absoluteFill, pressable ? animatedHighlight : { opacity: highlight }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[...GLASS_HIGHLIGHT]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.4 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      </Animated.View>

      {/* Content */}
      <View style={innerStyle}>{children}</View>
    </Animated.View>
  );

  if (pressable) {
    return <GestureDetector gesture={tap}>{card}</GestureDetector>;
  }

  return card;
}
