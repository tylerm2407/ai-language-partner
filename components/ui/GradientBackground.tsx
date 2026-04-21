/**
 * GradientBackground — cosmic ambient (default) + focus variants.
 *
 * Default (`variant="base"` or `variant="cosmic"`): subtle cosmic ambience —
 *   - dark surface.base with a faint indigo center-radial
 *   - two slow-drifting "aurora" gradient blobs (indigo + violet), very low
 *     opacity, 22–28 s cycles
 *   - 8 small twinkling "star" specks with staggered 4–6 s opacity cycles
 *
 * Focus (`variant="raised"`): calm, motion-free surface.raised — used on
 *   learning surfaces (lesson runner, review, reading) where Mayer's
 *   coherence principle requires zero decorative motion.
 *
 * Plain (`variant="plain"`): pure solid surface.base — used by sheets/modals.
 *
 * All motion honors `useMotion().shouldReduce` → falls back to a static
 * gradient with blobs centered + stars at fixed opacity. Haptics are
 * unaffected.
 *
 * Research: design-research.md §7 "Subtle breathing animation (Calm-style)
 * only on dedicated idle states... always gated on Reduce Motion."
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet, type ViewStyle, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../config/theme';
import { useMotion } from '../../hooks/useMotion';

type Variant = 'base' | 'cosmic' | 'raised' | 'plain';

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /**
   * - `base` / `cosmic` (default): subtle cosmic ambience with aurora blobs
   *   and twinkling stars. For ambient / navigation / non-focus screens.
   * - `raised`: motion-free `surface.raised` — for lesson runner, review,
   *   reading, and any sustained-focus surface.
   * - `plain`: pure `surface.base` solid — for sheets/modals/internal fills.
   */
  variant?: Variant;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Star positions are generated once per module load so they stay stable
// across re-renders within a session.
const STAR_COUNT = 8;
const STAR_POSITIONS = Array.from({ length: STAR_COUNT }, (_, i) => ({
  x: (SCREEN_W * ((i * 137) % 100)) / 100,
  y: (SCREEN_H * ((i * 89 + 23) % 100)) / 100,
  size: 1.5 + ((i * 7) % 3) * 0.5,
  phaseMs: (i * 800) % 4000, // staggered 0–4s starts
  cycleMs: 4000 + ((i * 700) % 2500), // 4–6.5 s cycles
}));

export function GradientBackground({
  children,
  style,
  variant = 'base',
}: GradientBackgroundProps) {
  const { shouldReduce } = useMotion();

  // ─── Raised / plain variants — calm, no motion ──────────────────────────
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

  // ─── Cosmic (default / base) ────────────────────────────────────────────
  return <CosmicBackground style={style} shouldReduce={shouldReduce}>{children}</CosmicBackground>;
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

  // Blob drift ranges — kept small so motion is barely perceptible.
  const blob1X = blob1.interpolate({ inputRange: [0, 1], outputRange: [-60, 80] });
  const blob1Y = blob1.interpolate({ inputRange: [0, 1], outputRange: [-40, 60] });
  const blob2X = blob2.interpolate({ inputRange: [0, 1], outputRange: [60, -80] });
  const blob2Y = blob2.interpolate({ inputRange: [0, 1], outputRange: [80, -40] });

  return (
    <View style={[styles.flex, { backgroundColor: colors.surface.base }, style]}>
      {/* Base radial-ish tint — using a diagonal linear as a cheap approximation */}
      <LinearGradient
        colors={['rgba(99, 102, 241, 0.06)', 'transparent', 'rgba(12, 15, 20, 0.0)']}
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

      {/* Aurora blob 2 — violet, bottom-right drift, opposite phase */}
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

      {/* Stars — small, slowly twinkling specks */}
      <StarField shouldReduce={shouldReduce} />

      {/* Content */}
      <View style={styles.flex}>{children}</View>
    </View>
  );
}

function StarField({ shouldReduce }: { shouldReduce: boolean }) {
  // Each star needs its own Animated.Value; memoize so they're stable.
  const stars = useMemo(
    () =>
      STAR_POSITIONS.map((s) => ({
        ...s,
        opacity: new Animated.Value(shouldReduce ? 0.4 : 0.25),
      })),
    [shouldReduce]
  );

  useEffect(() => {
    if (shouldReduce) return;
    const loops = stars.map((star) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(star.phaseMs),
          Animated.timing(star.opacity, {
            toValue: 0.6,
            duration: star.cycleMs / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(star.opacity, {
            toValue: 0.2,
            duration: star.cycleMs / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return loop;
    });
    return () => loops.forEach((l) => l.stop());
  }, [shouldReduce, stars]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.size * 2,
            height: s.size * 2,
            borderRadius: s.size,
            backgroundColor: '#E0E7FF',
            opacity: s.opacity,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  blob: {
    position: 'absolute',
  },
});
