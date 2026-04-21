/**
 * GradientBackground — cosmic ambient (default) + focus variants.
 *
 * Default (`variant="base"` or `variant="cosmic"`): a galaxy-flavored cosmic
 * ambience — dark surface with two slow-drifting aurora blobs (indigo +
 * violet), a subtle static cyan accent for color depth, and an 18-star
 * field where each star:
 *   - has a tailwind-colored halo glow (outer soft disc + bright core)
 *   - follows its own slow elliptical orbit (translateX + translateY
 *     interpolated from a 0→1 progress loop)
 *   - twinkles on opacity + subtly scales (bright at peak, slightly bigger)
 *   - uses PARALLAX DEPTH: bright stars drift faster + farther
 *     (foreground), small stars drift slower + less (background)
 *
 * Focus (`variant="raised"`): calm, motion-free surface.raised — used on
 *   learning surfaces (lesson runner, writing prompt) where Mayer's
 *   coherence principle requires zero decorative motion.
 *
 * Plain (`variant="plain"`): pure solid surface.base — used by sheets/modals.
 *
 * All motion honors `useMotion().shouldReduce` → stars hold at reduced
 * opacity + zero drift; aurora blobs freeze at midpoint.
 *
 * Research: design-research.md §7 "Subtle breathing animation only on
 * dedicated idle states... always gated on Reduce Motion."
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../config/theme';
import { useMotion } from '../../hooks/useMotion';

type Variant = 'base' | 'cosmic' | 'raised' | 'plain';

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: Variant;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Star palette (tailwind) ─────────────────────────────────────────────
const STAR_COLORS = [
  '#F8FAFC', // slate-50 — pure white
  '#E2E8F0', // slate-200 — dim white
  '#818CF8', // indigo-400
  '#A78BFA', // violet-400
  '#38BDF8', // sky-400
  '#67E8F9', // cyan-300
  '#F9A8D4', // pink-300
  '#FDE68A', // amber-200
];

// ─── Star tiers — parallax depth (bigger = faster + farther drift) ──────
interface TierConfig {
  count: number;
  core: number;
  halo: number;
  peakOpacity: number;
  /** Horizontal drift radius range (px) — foreground larger than background */
  rxRange: [number, number];
  /** Vertical drift radius range (px) */
  ryRange: [number, number];
  /** Full-orbit duration range (ms) — foreground faster than background */
  driftMsRange: [number, number];
  /** Twinkle period range (ms) */
  twinkleMsRange: [number, number];
}

const STAR_TIERS: Record<'bright' | 'medium' | 'small', TierConfig> = {
  bright: {
    count: 4,
    core: 3,
    halo: 14,
    peakOpacity: 0.95,
    rxRange: [35, 70], // foreground — wide drift
    ryRange: [25, 50],
    driftMsRange: [12000, 20000], // faster
    twinkleMsRange: [3000, 5000],
  },
  medium: {
    count: 8,
    core: 2,
    halo: 8,
    peakOpacity: 0.75,
    rxRange: [18, 40], // middle
    ryRange: [12, 28],
    driftMsRange: [18000, 30000],
    twinkleMsRange: [4000, 6500],
  },
  small: {
    count: 6,
    core: 1.5,
    halo: 5,
    peakOpacity: 0.55,
    rxRange: [8, 22], // background — minimal drift
    ryRange: [6, 16],
    driftMsRange: [28000, 42000], // slower (background)
    twinkleMsRange: [5000, 8000],
  },
};

type StarTier = keyof typeof STAR_TIERS;

interface StarSpec {
  id: number;
  x: number;
  y: number;
  tier: StarTier;
  coreSize: number;
  haloSize: number;
  color: string;
  peakOpacity: number;
  minOpacity: number;
  twinklePhaseMs: number;
  twinkleCycleMs: number;
  driftPhaseMs: number;
  driftCycleMs: number;
  driftRadiusX: number;
  driftRadiusY: number;
  /** 1 or -1 — reverses orbit direction so stars orbit both clockwise and ccw */
  orbitDirection: 1 | -1;
}

/** Deterministic pseudorandom in [0,1) from an integer seed. */
function det(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const STARS: StarSpec[] = (() => {
  const out: StarSpec[] = [];
  let id = 0;
  (['bright', 'medium', 'small'] as const).forEach((tier) => {
    const cfg = STAR_TIERS[tier];
    for (let i = 0; i < cfg.count; i++) {
      const seed = id * 127 + 1;
      const r1 = det(seed);
      const r2 = det(seed + 1);
      const r3 = det(seed + 2);
      const r4 = det(seed + 3);
      const r5 = det(seed + 4);
      const r6 = det(seed + 5);
      const r7 = det(seed + 6);

      out.push({
        id,
        x: (0.04 + r1 * 0.92) * SCREEN_W,
        y: (0.05 + r2 * 0.9) * SCREEN_H,
        tier,
        coreSize: cfg.core,
        haloSize: cfg.halo,
        color: STAR_COLORS[id % STAR_COLORS.length],
        peakOpacity: cfg.peakOpacity,
        minOpacity: cfg.peakOpacity * 0.25,
        twinklePhaseMs: Math.floor(r3 * cfg.twinkleMsRange[1]),
        twinkleCycleMs:
          cfg.twinkleMsRange[0] + Math.floor(r4 * (cfg.twinkleMsRange[1] - cfg.twinkleMsRange[0])),
        driftPhaseMs: Math.floor(r5 * 10000),
        driftCycleMs:
          cfg.driftMsRange[0] + Math.floor(r6 * (cfg.driftMsRange[1] - cfg.driftMsRange[0])),
        driftRadiusX: cfg.rxRange[0] + r7 * (cfg.rxRange[1] - cfg.rxRange[0]),
        driftRadiusY: cfg.ryRange[0] + det(seed + 7) * (cfg.ryRange[1] - cfg.ryRange[0]),
        orbitDirection: det(seed + 8) > 0.5 ? 1 : -1,
      });
      id++;
    }
  });
  return out;
})();

// ─── Component ───────────────────────────────────────────────────────────

export function GradientBackground({
  children,
  style,
  variant = 'base',
}: GradientBackgroundProps) {
  const { shouldReduce } = useMotion();

  if (variant === 'raised') {
    return (
      <View style={[styles.flex, { backgroundColor: colors.surface.raised }, style]}>
        {children}
      </View>
    );
  }
  if (variant === 'plain') {
    return (
      <View style={[styles.flex, { backgroundColor: colors.surface.base }, style]}>
        {children}
      </View>
    );
  }
  return (
    <CosmicBackground style={style} shouldReduce={shouldReduce}>
      {children}
    </CosmicBackground>
  );
}

function CosmicBackground({
  children,
  style,
  shouldReduce,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  shouldReduce: boolean;
}) {
  const blob1 = useRef(new Animated.Value(0)).current;
  const blob2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shouldReduce) {
      blob1.setValue(0.5);
      blob2.setValue(0.5);
      return;
    }
    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(blob1, {
          toValue: 1,
          duration: 26000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(blob1, {
          toValue: 0,
          duration: 26000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(blob2, {
          toValue: 1,
          duration: 22000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(blob2, {
          toValue: 0,
          duration: 22000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop1.start();
    loop2.start();
    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, [shouldReduce, blob1, blob2]);

  const blob1X = blob1.interpolate({ inputRange: [0, 1], outputRange: [-60, 80] });
  const blob1Y = blob1.interpolate({ inputRange: [0, 1], outputRange: [-40, 60] });
  const blob2X = blob2.interpolate({ inputRange: [0, 1], outputRange: [60, -80] });
  const blob2Y = blob2.interpolate({ inputRange: [0, 1], outputRange: [80, -40] });

  return (
    <View style={[styles.flex, { backgroundColor: colors.surface.base }, style]}>
      {/* Base top-down indigo tint */}
      <LinearGradient
        colors={['rgba(99, 102, 241, 0.07)', 'transparent', 'rgba(12, 15, 20, 0.0)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Aurora blob 1 — indigo */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            transform: [{ translateX: blob1X }, { translateY: blob1Y }],
            width: SCREEN_W * 1.3,
            height: SCREEN_H * 0.9,
            top: -SCREEN_H * 0.2,
            left: -SCREEN_W * 0.2,
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(99, 102, 241, 0.22)', 'rgba(99, 102, 241, 0.08)', 'transparent']}
          locations={[0, 0.35, 0.85]}
          start={{ x: 0.3, y: 0.3 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Aurora blob 2 — violet */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            transform: [{ translateX: blob2X }, { translateY: blob2Y }],
            width: SCREEN_W * 1.3,
            height: SCREEN_H * 0.9,
            bottom: -SCREEN_H * 0.2,
            right: -SCREEN_W * 0.2,
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(168, 85, 247, 0.12)', 'rgba(168, 85, 247, 0.22)']}
          locations={[0.15, 0.65, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0.7 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Aurora accent 3 — cyan, static */}
      <View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            width: SCREEN_W * 0.9,
            height: SCREEN_H * 0.5,
            top: SCREEN_H * 0.25,
            left: SCREEN_W * 0.05,
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(56, 189, 248, 0.10)', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <StarField shouldReduce={shouldReduce} />

      <View style={styles.flex}>{children}</View>
    </View>
  );
}

function StarField({ shouldReduce }: { shouldReduce: boolean }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STARS.map((s) => (
        <Star key={s.id} star={s} shouldReduce={shouldReduce} />
      ))}
    </View>
  );
}

function Star({ star, shouldReduce }: { star: StarSpec; shouldReduce: boolean }) {
  const opacity = useRef(new Animated.Value(star.minOpacity)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shouldReduce) {
      opacity.setValue(star.peakOpacity * 0.6);
      progress.setValue(0);
      return;
    }

    const twinkle = Animated.loop(
      Animated.sequence([
        Animated.delay(star.twinklePhaseMs),
        Animated.timing(opacity, {
          toValue: star.peakOpacity,
          duration: star.twinkleCycleMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: star.minOpacity,
          duration: star.twinkleCycleMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Orbit: progress 0 → 1 linearly over driftCycleMs; interpolated into
    // an elliptical path via cosine / sine-shaped outputs.
    const orbit = Animated.loop(
      Animated.sequence([
        Animated.delay(star.driftPhaseMs),
        Animated.timing(progress, {
          toValue: 1,
          duration: star.driftCycleMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    twinkle.start();
    orbit.start();
    return () => {
      twinkle.stop();
      orbit.stop();
    };
  }, [shouldReduce, star, opacity, progress]);

  // Elliptical orbit via 5-point cosine/sine approximation. At progress 0.25
  // and 0.75 the values pass through the axes; 0/1 returns to the starting
  // point. orbitDirection flips the rotation direction.
  const translateX = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [
      star.driftRadiusX,
      0,
      -star.driftRadiusX,
      0,
      star.driftRadiusX,
    ].map((v) => v * star.orbitDirection) as [number, number, number, number, number],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -star.driftRadiusY, 0, star.driftRadiusY, 0],
  });

  // Core scale — subtly grows as the star brightens (0.9 → 1.15)
  const scale = opacity.interpolate({
    inputRange: [star.minOpacity, star.peakOpacity],
    outputRange: [0.9, 1.15],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: star.x - star.haloSize / 2,
        top: star.y - star.haloSize / 2,
        width: star.haloSize,
        height: star.haloSize,
        transform: [{ translateX }, { translateY }],
      }}
    >
      {/* Halo — soft outer glow */}
      <View
        style={{
          position: 'absolute',
          width: star.haloSize,
          height: star.haloSize,
          borderRadius: star.haloSize / 2,
          backgroundColor: star.color,
          opacity: 0.15,
        }}
      />

      {/* Core — bright center; opacity twinkles + scale pulses with it */}
      <Animated.View
        style={{
          position: 'absolute',
          top: (star.haloSize - star.coreSize) / 2,
          left: (star.haloSize - star.coreSize) / 2,
          width: star.coreSize,
          height: star.coreSize,
          borderRadius: star.coreSize / 2,
          backgroundColor: star.color,
          opacity,
          transform: [{ scale }],
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  blob: {
    position: 'absolute',
  },
});
