import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp, type AccessibilityRole } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface GlassSurfaceProps {
  children: React.ReactNode;
  borderRadius?: number;
  brightness?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
}

/**
 * React Native port of the ReactBits GlassSurface.
 * Reproduces the chromatic-aberration edge glow + inner light refraction
 * using stacked LinearGradient layers — no native blur or SVG filters needed.
 */
export function GlassSurface({
  children,
  borderRadius = 20,
  brightness = 50,
  opacity = 0.93,
  style,
  innerStyle,
  accessibilityLabel,
  accessibilityRole,
}: GlassSurfaceProps) {
  // Map brightness (0-100) to a fill alpha — higher brightness = lighter fill
  const fillAlpha = Math.min(1, Math.max(0, brightness / 100)) * 0.15;
  const fillColor = `rgba(255, 255, 255, ${(fillAlpha * opacity).toFixed(3)})`;
  const bgColor = `rgba(21, 25, 33, ${(0.35 * opacity).toFixed(2)})`;

  return (
    <View
      style={[{ borderRadius, overflow: 'hidden' }, style]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
    >
      {/* Layer 0 — Translucent dark fill (lets galaxy bleed through) */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: bgColor, borderRadius },
        ]}
        pointerEvents="none"
      />

      {/* Layer 1 — Chromatic aberration: red/magenta edge (top-left) */}
      <LinearGradient
        colors={['rgba(248, 113, 113, 0.12)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        pointerEvents="none"
      />

      {/* Layer 2 — Chromatic aberration: blue/cyan edge (bottom-right) */}
      <LinearGradient
        colors={['transparent', 'rgba(56, 189, 248, 0.10)']}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        pointerEvents="none"
      />

      {/* Layer 3 — Chromatic aberration: green channel shift (bottom-left) */}
      <LinearGradient
        colors={['transparent', 'rgba(52, 211, 153, 0.06)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        pointerEvents="none"
      />

      {/* Layer 4 — White translucent fill for frost */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: fillColor, borderRadius },
        ]}
        pointerEvents="none"
      />

      {/* Layer 5 — Specular highlight (top edge light refraction) */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.02)', 'transparent']}
        locations={[0, 0.3, 0.6]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        pointerEvents="none"
      />

      {/* Layer 6 — Inset border glow (simulates inset box-shadow) */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.15)',
            // Top edge brighter via a second border trick
            borderTopColor: 'rgba(255, 255, 255, 0.25)',
            borderBottomColor: 'rgba(255, 255, 255, 0.06)',
          },
        ]}
        pointerEvents="none"
      />

      {/* Content */}
      <View style={innerStyle}>{children}</View>
    </View>
  );
}
