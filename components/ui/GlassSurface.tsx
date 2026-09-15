import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp, type AccessibilityRole } from 'react-native';
import { radii } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';

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
 * Formerly: 6-layer chromatic-aberration glass with specular sheen; then, under
 * Dark Glow, an opaque surface.card with a 1px border.
 *
 * Now it is the UI 2.0 slab: `card` fill, `cardBorder` outline at `shape.border`
 * with the thicker `shape.slab` bottom edge — the same geometry as
 * `components/ui2/SlabCard`, which DESIGN.md's migration table names as this
 * component's UI 2.0 counterpart. It stays a distinct component only because
 * `borderRadius` / `innerStyle` are part of its public API; new code should
 * reach for SlabCard.
 *
 * Depth now comes from the slab edge rather than from an ambient glow behind
 * the card — UI 2.0 grounds on a flat `c.bg` and has no glow layer.
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
  const { c, shape } = useUi2Theme();
  return (
    <View
      style={[
        styles.container,
        {
          borderRadius,
          backgroundColor: c.card,
          borderColor: c.cardBorder,
          borderWidth: shape.border,
          borderBottomWidth: shape.slab,
        },
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
    overflow: 'hidden',
  },
});
