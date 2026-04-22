import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Dimensions, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';

import { DEEP_NEBULA } from '../../config/gradients';

// ── Aurora Color Palette ──────────────────────────────────────
// Deep Nebula: #0a0520 / #1a0a3e / #0f0a2e base
// Accent: #4F8EF7 (blue), #7C3AED (violet), #A855F7 (lilac)
const BASE_GRADIENT: [string, string, string] = [...DEEP_NEBULA];
const AURORA_BLUE = 'rgba(79, 142, 247, 0.40)';
const AURORA_VIOLET = 'rgba(124, 58, 237, 0.55)';
const AURORA_LIGHT_BLUE = 'rgba(95, 160, 255, 0.30)';
const BAND_LILAC = 'rgba(168, 85, 247, 0.14)';

// ── Star Config ───────────────────────────────────────────────
const STAR_COUNT = 80;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface StarData {
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  delay: number;
  duration: number;
}

function generateStars(count: number): StarData[] {
  const stars: StarData[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * SCREEN_W,
      y: Math.random() * SCREEN_H,
      size: 1 + Math.random() * 1.5,
      baseOpacity: 0.1 + Math.random() * 0.45,
      delay: Math.random() * 3000,
      duration: 2000 + Math.random() * 2000,
    });
  }
  return stars;
}

// ── Individual Star Component ─────────────────────────────────
function Star({ data }: { data: StarData }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      data.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: data.duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: data.duration / 2, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [data.delay, data.duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [data.baseOpacity * 0.2, data.baseOpacity]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.8, 1.2]) }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: data.x,
          top: data.y,
          width: data.size,
          height: data.size,
          borderRadius: data.size / 2,
          backgroundColor: '#FFFFFF',
        },
        animatedStyle,
      ]}
    />
  );
}

// ── Starfield (memoized to avoid re-generating stars) ─────────
const Starfield = React.memo(function Starfield() {
  const stars = useMemo(() => generateStars(STAR_COUNT), []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((star, i) => (
        <Star key={i} data={star} />
      ))}
    </View>
  );
});

// ── Aurora Glow Layer ─────────────────────────────────────────
function AuroraGlow() {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 11000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [drift]);

  const auroraStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(drift.value, [0, 1], [0, -40]) },
      { skewY: `${interpolate(drift.value, [0, 1], [-8, -4])}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.auroraContainer, auroraStyle]} pointerEvents="none">
      {/* Blue glow — top-left */}
      <View style={[styles.auroraBlob, styles.auroraBlobBlue]} />
      {/* Violet glow — right-center */}
      <View style={[styles.auroraBlob, styles.auroraBlobViolet]} />
      {/* Light blue glow — bottom-center */}
      <View style={[styles.auroraBlob, styles.auroraBlobLightBlue]} />
    </Animated.View>
  );
}

// ── Light Band ────────────────────────────────────────────────
function LightBand() {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [shimmer]);

  const bandStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.6, 1.0]),
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, bandStyle]} pointerEvents="none">
      <LinearGradient
        colors={['transparent', BAND_LILAC, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        locations={[0.35, 0.55, 0.75]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ── Grain Overlay ─────────────────────────────────────────────
function GrainOverlay() {
  return <View style={styles.grain} pointerEvents="none" />;
}

// ── Main Component ────────────────────────────────────────────
interface AuroraBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function AuroraBackground({ children, style }: AuroraBackgroundProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Layer 0: Base gradient */}
      <LinearGradient
        colors={[...BASE_GRADIENT]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Layer 1: Aurora glow blobs (animated drift) */}
      <AuroraGlow />

      {/* Layer 2: Diagonal light band (animated shimmer) */}
      <LightBand />

      {/* Layer 3: Twinkling stars */}
      <Starfield />

      {/* Layer 4: Film grain texture */}
      <GrainOverlay />

      {/* Content */}
      {children}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DEEP_NEBULA[0],
  },
  auroraContainer: {
    ...StyleSheet.absoluteFillObject,
    top: '-10%',
    left: '-10%',
    right: '-10%',
    bottom: '-10%',
  },
  auroraBlob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  auroraBlobBlue: {
    // ellipse 80% 30% at 20% 25%
    left: '5%',
    top: '15%',
    width: '90%',
    height: '35%',
    backgroundColor: AURORA_BLUE,
    transform: [{ scaleX: 1.6 }],
  },
  auroraBlobViolet: {
    // ellipse 100% 35% at 85% 55%
    right: '-15%',
    top: '40%',
    width: '100%',
    height: '40%',
    backgroundColor: AURORA_VIOLET,
    transform: [{ scaleX: 1.8 }],
  },
  auroraBlobLightBlue: {
    // ellipse 90% 28% at 40% 85%
    left: '5%',
    bottom: '5%',
    width: '85%',
    height: '30%',
    backgroundColor: AURORA_LIGHT_BLUE,
    transform: [{ scaleX: 1.6 }],
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
    backgroundColor: 'transparent',
    // Film grain via a subtle noise pattern
    // On native this is very subtle — just a slight texture
    borderWidth: 0,
  },
});
