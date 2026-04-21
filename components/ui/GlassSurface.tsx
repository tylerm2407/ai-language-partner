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
 * GlassSurface — SIMPLIFIED (Phase 0).
 *
 * Formerly: 6-layer chromatic-aberration glass with specular sheen.
 * Now: single dark fill + hairline border. Same API so every existing
 * consumer (profile, teacher dashboard, modals, etc.) keeps working.
 *
 * The chromatic-aberration "glass" treatment was visually busy and
 * competed with learning content (Mayer coherence). Replaced with a flat
 * card surface that still reads as an elevated region but without the
 * decorative sheen. See design-research.md + redesign-plan.md.
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
    borderColor: colors.border.subtle,
    overflow: 'hidden',
  },
});
