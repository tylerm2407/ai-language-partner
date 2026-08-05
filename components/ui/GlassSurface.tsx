import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp, type AccessibilityRole } from 'react-native';
import { colors, radii } from '../../config/theme';

export interface GlassSurfaceProps {
  children: React.ReactNode;
  borderRadius?: number;
  /** Kept for API compatibility; no longer changes visuals. */
  brightness?: number;
  /** Kept for API compatibility; no longer changes visuals. */
  opacity?: number;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
}

/**
 * GlassSurface — flat card surface. The name is historical; there is no glass.
 *
 * Formerly: 6-layer chromatic-aberration glass with specular sheen.
 * Now: opaque surface.card + 1px border.default, matching every other card
 * primitive under the Dark Glow theme. Same API so every existing consumer
 * (profile, teacher dashboard, modals, etc.) keeps working.
 *
 * Depth comes from the ambient glow layer behind the card, not from the card
 * itself — per-card translucency competed with the glow and muddied it.
 * See DESIGN.md §Glow + §Cards.
 */
export function GlassSurface({
  children,
  borderRadius = radii.xxl,
  style,
  innerStyle,
  accessibilityLabel,
  accessibilityRole,
  // brightness / opacity are accepted but intentionally ignored
}: GlassSurfaceProps) {
  return (
    <View
      style={[
        styles.container,
        { borderRadius },
        style,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
    >
      <View style={innerStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
});
