/**
 * GlowBackground — the ambient layer for the monochrome theme.
 *
 * ONE top-anchored silver wash. Not the retired three-blob indigo/violet layer.
 *
 * The blob layer was the theme's decorative signature and it is gone on
 * purpose: three drifting saturated blobs behind every screen is what read as
 * "consumer gamified app" more than any single component did, and it forced
 * `surface.base` down to a near-void so the blobs had something to glow
 * against. Studio Graphite gets its depth from the surface steps and hairline
 * borders instead, so the ambient layer only has to keep the top of the screen
 * from looking like a flat sheet.
 *
 * Implementation notes:
 *   - A single `react-native-svg` RadialGradient anchored above the top edge,
 *     wider than the window so its horizontal falloff never lands on screen.
 *     Peak alpha is 0.10 — it is a suggestion of light, not a light source.
 *   - There is NO drift. Chrome motion is retired (DESIGN.md §Motion rule 2),
 *     so nothing here needs to gate on Reduce Motion; the layer is static for
 *     every user. The `drift` prop is accepted and ignored for call-site
 *     compatibility.
 *   - `pointerEvents="none"` throughout — this layer never eats a touch.
 */

import React from 'react';
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '../../config/theme';

/** Peak opacity at the centre of the wash. */
const WASH_ALPHA = 0.09;
/** How far the wash reaches down the screen. */
const WASH_HEIGHT = 320;
/** Horizontal overscan, as a multiple of window width, so the left/right
 *  falloff of the radial sits off-screen instead of drawing a visible edge. */
const WASH_OVERSCAN = 1.6;

/** rgba(r,g,b,1) → its r,g,b triplet, so Stop can take stopOpacity separately. */
function stripAlpha(rgba: string): string {
  return rgba.replace(/rgba?\(([^)]+)\)/, (_, inner: string) => {
    const [r, g, b] = inner.split(',').map((v) => v.trim());
    return `rgb(${r}, ${g}, ${b})`;
  });
}

/**
 * GlowLayer — the wash on its own, as an absolutely-positioned sibling.
 *
 * Use this when a screen already owns its root container and wrapping it would
 * mean restructuring several early-return branches: drop `<GlowLayer />` in as
 * the first child of the root and set the root's own fill to surface.base.
 * Prefer `<GradientBackground>` for new screens.
 *
 * Must be the FIRST child. It deliberately carries NO positive zIndex: React
 * Native paints siblings in declaration order, and a sibling without zIndex is
 * treated as 0 — so giving the wash zIndex 1 would make it paint OVER the very
 * content it sits behind. First-child order is what puts it underneath.
 */
export function GlowLayer(_props: { drift?: boolean } = {}) {
  const { width } = useWindowDimensions();
  const washWidth = width * WASH_OVERSCAN;
  const tint = stripAlpha(colors.glow.silver);

  return (
    <View pointerEvents="none" style={styles.glowLayer}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -WASH_HEIGHT * 0.45,
          left: (width - washWidth) / 2,
          width: washWidth,
          height: WASH_HEIGHT,
        }}
      >
        <Svg width={washWidth} height={WASH_HEIGHT} pointerEvents="none">
          <Defs>
            <RadialGradient id="studio-wash" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={tint} stopOpacity={WASH_ALPHA} />
              <Stop offset="0.55" stopColor={tint} stopOpacity={WASH_ALPHA * 0.4} />
              <Stop offset="0.85" stopColor={tint} stopOpacity={WASH_ALPHA * 0.1} />
              <Stop offset="1" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={washWidth} height={WASH_HEIGHT} fill="url(#studio-wash)" />
        </Svg>
      </View>
    </View>
  );
}

/**
 * StatBloom — a soft radial halo that sits BEHIND a numeral.
 *
 * The monochrome palette has no accent colour to draw the eye with, so emphasis
 * has to come from light. A bloom behind the streak count or XP total does the
 * job an accent fill used to do, without introducing a hue.
 *
 * Usage: wrap the numeral, not the whole row. The bloom is absolutely
 * positioned and centred on its parent, so the parent needs a size.
 *
 *   <View style={{ alignItems: 'center', justifyContent: 'center' }}>
 *     <StatBloom size={90} />
 *     <Text>{streak}</Text>
 *   </View>
 *
 * It is `pointerEvents="none"` and carries no zIndex — like `GlowLayer`, it
 * relies on being declared FIRST so React Native paints it underneath.
 *
 * Static: no motion, nothing to gate on Reduce Motion.
 */
export function StatBloom({
  size = 90,
  intensity = 0.16,
}: {
  /** Diameter of the halo in px. Should comfortably exceed the numeral. */
  size?: number;
  /** Peak opacity at the centre. Keep low — this is light, not a fill. */
  intensity?: number;
}) {
  const tint = stripAlpha(colors.glow.bloom);
  const id = `stat-bloom-${size}-${Math.round(intensity * 100)}`;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={size} height={size} pointerEvents="none">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tint} stopOpacity={intensity} />
            <Stop offset="0.45" stopColor={tint} stopOpacity={intensity * 0.45} />
            <Stop offset="0.75" stopColor={tint} stopOpacity={intensity * 0.14} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

interface GlowBackgroundProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Screen-level fill under the wash. Defaults to surface.base. */
  backgroundColor?: string;
  /** @deprecated Accepted and ignored — the ambient layer no longer animates.
   *  Kept so the screens that pass `drift={false}` keep compiling. */
  drift?: boolean;
}

export function GlowBackground({
  children,
  style,
  backgroundColor = colors.surface.base,
}: GlowBackgroundProps) {
  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      <GlowLayer />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  /** No zIndex — paint order comes from being the first child. See GlowLayer. */
  glowLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  content: { flex: 1 },
});
