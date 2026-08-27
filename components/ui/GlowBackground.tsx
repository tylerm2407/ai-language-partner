/**
 * GlowBackground — the ambient layer for the Dark Glow theme.
 *
 * Three low-opacity indigo/violet radial blobs sitting between the base fill
 * and screen content. This is the app's canonical background; see DESIGN.md
 * §Glow for the token table.
 *
 * Implementation notes:
 *   - The blobs are `react-native-svg` RadialGradients with a soft stop ramp
 *     (0.55 → 0.8 → 1.0), NOT a blurred view. A gradient that already fades
 *     to transparent needs no blur, and a full-screen BlurView under every
 *     screen costs real scroll frames on Android — the same reason the card
 *     primitives dropped glass.
 *   - Drift is three offset 9/12/15s translate+scale loops. It gates on
 *     `useMotion().shouldReduce`: with Reduce Motion on, blobs render at their
 *     rest position and never animate.
 *   - It ALSO gates on focus. React Navigation keeps visited tabs mounted, so
 *     without that gate a learner who had touched Home, Learn, Chat and
 *     Profile left twelve infinite loops running — driving twelve scaled and
 *     translated GPU layers of which at most three were ever visible, for the
 *     rest of the session. Reduce Motion was the only thing that could stop
 *     them.
 *   - `pointerEvents="none"` throughout — this layer never eats a touch.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { colors } from '../../config/theme';
import { useMotion } from '../../hooks/useMotion';

// ─── Blob specs ───────────────────────────────────────────────────────────
// Geometry and alpha are the deck's values verbatim. `anchor` is resolved
// against the window so the composition holds on every device size.
interface BlobSpec {
  size: number;
  color: string;
  alpha: number;
  anchor: { top?: number; left?: number; bottom?: number; right?: number; topPct?: number; leftPct?: number };
  /** Multi-point drift loop: [x, y, scale] triplets, looped back to rest. */
  drift: readonly (readonly [number, number, number])[];
  durationMs: number;
}

const BLOBS: readonly BlobSpec[] = [
  {
    size: 340,
    color: colors.glow.indigo,
    alpha: 0.35,
    anchor: { top: -80, left: -100 },
    drift: [
      [70, 55, 1.15],
      [-40, 80, 0.9],
      [0, 0, 1],
    ],
    durationMs: 9000,
  },
  {
    size: 380,
    color: colors.glow.violet,
    alpha: 0.3,
    anchor: { bottom: -120, right: -120 },
    drift: [
      [-65, -50, 0.88],
      [45, -85, 1.12],
      [0, 0, 1],
    ],
    durationMs: 12000,
  },
  {
    size: 260,
    color: colors.glow.lilacIndigo,
    alpha: 0.2,
    anchor: { topPct: 0.38, leftPct: 0.55 },
    drift: [
      [60, -65, 1.2],
      [-60, -20, 0.9],
      [0, 0, 1],
    ],
    durationMs: 15000,
  },
] as const;

/** rgba(r,g,b,1) → its r,g,b triplet, so Stop can take stopOpacity separately. */
function stripAlpha(rgba: string): string {
  return rgba.replace(/rgba?\(([^)]+)\)/, (_, inner: string) => {
    const [r, g, b] = inner.split(',').map((v) => v.trim());
    return `rgb(${r}, ${g}, ${b})`;
  });
}

function Blob({ spec, animate, index }: { spec: BlobSpec; animate: boolean; index: number }) {
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);
  const gradientId = `glow-blob-${index}`;

  useEffect(() => {
    if (!animate) {
      // `cancelAnimation` first: assigning to a shared value does not stop an
      // in-flight `withRepeat`, so without this the loop kept running and
      // fought the assignment every frame.
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    // One shared 0→1→2→3 ramp; the animated style reads keyframes off it.
    progress.value = 0;
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: spec.durationMs / 3, easing: Easing.inOut(Easing.ease) }),
        withTiming(2, { duration: spec.durationMs / 3, easing: Easing.inOut(Easing.ease) }),
        withTiming(3, { duration: spec.durationMs / 3, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [animate, progress, spec.durationMs]);

  const animatedStyle = useAnimatedStyle(() => {
    const points = [[0, 0, 1] as const, ...spec.drift];
    const p = progress.value;
    const from = points[Math.floor(p) % points.length];
    const to = points[(Math.floor(p) + 1) % points.length];
    const f = p - Math.floor(p);
    return {
      transform: [
        { translateX: from[0] + (to[0] - from[0]) * f },
        { translateY: from[1] + (to[1] - from[1]) * f },
        { scale: from[2] + (to[2] - from[2]) * f },
      ],
    };
  });

  const position: ViewStyle = {
    top: spec.anchor.topPct != null ? height * spec.anchor.topPct : spec.anchor.top,
    left: spec.anchor.leftPct != null ? width * spec.anchor.leftPct : spec.anchor.left,
    bottom: spec.anchor.bottom,
    right: spec.anchor.right,
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: spec.size, height: spec.size }, position, animatedStyle]}
    >
      <Svg width={spec.size} height={spec.size} pointerEvents="none">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={stripAlpha(spec.color)} stopOpacity={spec.alpha} />
            <Stop offset="0.55" stopColor={stripAlpha(spec.color)} stopOpacity={spec.alpha * 0.45} />
            <Stop offset="0.8" stopColor={stripAlpha(spec.color)} stopOpacity={spec.alpha * 0.12} />
            <Stop offset="1" stopColor={stripAlpha(spec.color)} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={spec.size} height={spec.size} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * GlowLayer — the blob layer on its own, as an absolutely-positioned sibling.
 *
 * Use this when a screen already owns its root container and wrapping it would
 * mean restructuring several early-return branches: drop `<GlowLayer />` in as
 * the first child of the root and set the root's own fill to surface.base.
 * Prefer `<GradientBackground>` for new screens.
 *
 * Must be the FIRST child. It deliberately carries NO positive zIndex: React
 * Native paints siblings in declaration order, and a sibling without zIndex is
 * treated as 0 — so giving the glow zIndex 1 would make it paint OVER the very
 * content it sits behind. First-child order is what puts it underneath.
 */
export function GlowLayer({ drift = true }: { drift?: boolean }) {
  const { shouldReduce } = useMotion();
  // Only the screen the learner is actually looking at animates. Backgrounded
  // tabs stay mounted and would otherwise keep their loops running forever.
  const isFocused = useIsFocused();
  const animate = drift && !shouldReduce && isFocused;

  return (
    <View pointerEvents="none" style={styles.glowLayer}>
      {BLOBS.map((spec, i) => (
        <Blob key={i} spec={spec} animate={animate} index={i} />
      ))}
    </View>
  );
}

interface GlowBackgroundProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Screen-level fill under the glow. Defaults to surface.base. */
  backgroundColor?: string;
  /** Set false on focus surfaces (lesson runner, writing) — Mayer's coherence
   *  principle wants zero decorative motion while a learner is working. */
  drift?: boolean;
}

export function GlowBackground({
  children,
  style,
  backgroundColor = colors.surface.base,
  drift = true,
}: GlowBackgroundProps) {
  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      <GlowLayer drift={drift} />
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
