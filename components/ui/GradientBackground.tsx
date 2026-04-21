/**
 * GradientBackground — cosmic ambient (default) + focus variants.
 *
 * Default (`variant="base"` or `variant="cosmic"`): a discreet cosmic
 * ambience — dark surface with two slow-drifting aurora blobs (indigo +
 * violet), a subtle static cyan accent for color depth, and an 18-star
 * field with tailwind-colored halo glows + slow drift + independent
 * twinkle. Motion is deliberately barely perceptible.
 *
 * Focus (`variant="raised"`): calm, motion-free surface.raised — used on
 *   learning surfaces (lesson runner, writing prompt) where Mayer's
 *   coherence principle requires zero decorative motion.
 *
 * Plain (`variant="plain"`): pure solid surface.base — used by sheets/modals.
 *
 * All motion honors `useMotion().shouldReduce` → stars hold at reduced
 * opacity + zero drift; aurora blobs freeze at midpoint. Haptics unaffected.
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

// ─── Star palette (tailwind-colored) ──────────────────────────────────────
// Each star cycles through this palette by id; real night skies have color
// variety (red giants, blue-white, yellow, etc.) so using varied tailwind
// hues feels astronomically justified.
const STAR_COLORS = [
  '#F8FAFC', // slate-50 — classic white
  '#E2E8F0', // slate-200 — dimmer white
  '#818CF8', // indigo-400
  '#A78BFA', // violet-400
  '#38BDF8', // sky-400
  '#67E8F9', // cyan-300
  '#F9A8D4', // pink-300
  '#FDE68A', // amber-200
];

// Star tiers — bigger / brighter stars are rarer.
const STAR_TIERS = {
  bright: { count: 4, core: 3, halo: 14, peakOpacity: 0.95 },
  medium: { count: 8, core: 2, halo: 8, peakOpacity: 0.75 },
  small: { count: 6, core: 1.5, halo: 5, peakOpacity: 0.55 },
} as const;

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
  driftRange: number;
}

// Generated once per module load — stable across renders within a session.
const STARS: StarSpec[] = (() => {
  const out: StarSpec[] = [];
  let id = 0;
  (['bright', 'medium', 'small'] as const).forEach((tier) => {
    const cfg = STAR_TIERS[tier];
    for (let i = 0; i < cfg.count; i++) {
      const seed = id * 127 + 1;
      out.push({
        id,
        x: (((seed * 79) % 95) + 2.5) / 100 * SCREEN_W,
        y: (((seed * 43 + 11) % 92) + 4) / 100 * SCREEN_H,
        tier,
        coreSize: cfg.core,
        haloSize: cfg.halo,
        color: STAR_COLORS[id % STAR_COLORS.length],
        peakOpacity: cfg.peakOpacity,
        minOpacity: cfg.peakOpacity * 0.25,
        twinklePhaseMs: (id * 743) % 4500,
        twinkleCycleMs: 3500 + ((id * 317) % 2500), // 3.5–6s
        driftPhaseMs: (id * 1319) % 8000,
        driftCycleMs: 18000 + ((id * 541) % 12000), // 18–30s
        driftRange: 15 + ((id * 29) % 20), // 15–35px
      });
      id++;
    }
  });
  return out;
})();

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

// ─── Cosmic subcomponent ─────────────────────────────────────────────────

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
      {/* Base indigo top-down tint */}
      <LinearGradient
        colors={['rgba(99, 102, 241, 0.07)', 'transparent', 'rgba(12, 15, 20, 0.0)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Aurora blob 1 — indigo, top-left drift */}
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

      {/* Aurora blob 2 — violet, bottom-right drift */}
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

      {/* Aurora accent 3 — cyan, static, low alpha (color depth without
          adding to motion budget) */}
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

      {/* Star field with halo glows + drift + twinkle */}
      <StarField shouldReduce={shouldReduce} />

      <View style={styles.flex}>{children}</View>
    </View>
  );
}

// ─── Star field ──────────────────────────────────────────────────────────

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
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shouldReduce) {
      opacity.setValue(star.peakOpacity * 0.6);
      translateY.setValue(0);
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

    const drift = Animated.loop(
      Animated.sequence([
        Animated.delay(star.driftPhaseMs),
        Animated.timing(translateY, {
          toValue: star.driftRange,
          duration: star.driftCycleMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -star.driftRange,
          duration: star.driftCycleMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: star.driftCycleMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    twinkle.start();
    drift.start();
    return () => {
      twinkle.stop();
      drift.stop();
    };
  }, [shouldReduce, star, opacity, translateY]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: star.x - star.haloSize / 2,
        top: star.y - star.haloSize / 2,
        width: star.haloSize,
        height: star.haloSize,
        transform: [{ translateY }],
      }}
    >
      {/* Halo — soft outer glow using the star's tailwind color */}
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

      {/* Core — bright center point; twinkles */}
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
