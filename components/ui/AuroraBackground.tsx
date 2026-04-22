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

// ── Color palette — matched to the deep-space reference image ────
// Almost-black at top, deep indigo mid, dark violet base
const BASE_TOP = '#08081a';
const BASE_MID = '#0d0e25';
const BASE_BOT = '#110a28';

// Nebula bloom — concentrated purple, center-right
const NEBULA_PURPLE = 'rgba(60, 20, 120, 0.55)';
// Subtle steel-blue wash — upper-left quadrant
const NEBULA_BLUE = 'rgba(30, 50, 100, 0.30)';
// Faint warm lilac tint at very bottom edge
const BOTTOM_WARM = 'rgba(80, 50, 90, 0.20)';

// ── Star Config ───────────────────────────────────────────────
const STAR_COUNT = 65;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface StarData {
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  delay: number;
  duration: number;
  /** Warm stars get a slight warm tint (#FFF5E6), cool stars stay white */
  warm: boolean;
}

function generateStars(count: number): StarData[] {
  const stars: StarData[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * SCREEN_W,
      y: Math.random() * SCREEN_H,
      size: 0.8 + Math.random() * 1.4, // smaller, 0.8–2.2px
      baseOpacity: 0.15 + Math.random() * 0.55,
      delay: Math.random() * 5000,
      duration: 3000 + Math.random() * 4000, // slower twinkle
      warm: Math.random() > 0.5,
    });
  }
  return stars;
}

// ── Individual Star ──────────────────────────────────────────
function Star({ data }: { data: StarData }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      data.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: data.duration * 0.45, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: data.duration * 0.55, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [data.delay, data.duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [data.baseOpacity * 0.15, data.baseOpacity]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.85, 1.15]) }],
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
          backgroundColor: data.warm ? '#FFF5E8' : '#FFFFFF',
        },
        animatedStyle,
      ]}
    />
  );
}

// ── Starfield (memoized) ─────────────────────────────────────
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

// ── Nebula Glow Layer — slow breathing + gentle drift ────────
function NebulaGlow() {
  const breathe = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    // Slow breathing — opacity pulse
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    // Very slow spatial drift
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 14000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [breathe, drift]);

  const purpleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.7, 1.0]),
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [0, 12]) },
      { translateY: interpolate(drift.value, [0, 1], [0, -8]) },
    ],
  }));

  const blueStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.6, 0.9]),
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [0, -8]) },
      { translateY: interpolate(drift.value, [0, 1], [0, 6]) },
    ],
  }));

  const warmStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.5, 0.8]),
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Purple nebula bloom — center-right, the dominant feature */}
      <Animated.View style={[styles.blob, styles.blobPurple, purpleStyle]} />

      {/* Subtle steel-blue wash — upper-left */}
      <Animated.View style={[styles.blob, styles.blobBlue, blueStyle]} />

      {/* Faint warm bottom edge */}
      <Animated.View style={[styles.blob, styles.blobWarm, warmStyle]} />
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────
interface AuroraBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function AuroraBackground({ children, style }: AuroraBackgroundProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Layer 0: Vertical gradient — near-black → deep indigo → dark violet */}
      <LinearGradient
        colors={[BASE_TOP, BASE_MID, BASE_BOT]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Layer 1: Nebula glow blobs (slow breathe + drift) */}
      <NebulaGlow />

      {/* Layer 2: Twinkling stars */}
      <Starfield />

      {/* Content */}
      {children}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BASE_TOP,
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  // Purple nebula — large ellipse, center-right, ~40-70% vertical
  blobPurple: {
    right: '-20%',
    top: '35%',
    width: '110%',
    height: '45%',
    backgroundColor: NEBULA_PURPLE,
    transform: [{ scaleX: 1.3 }],
  },
  // Steel-blue wash — upper-left quadrant
  blobBlue: {
    left: '-15%',
    top: '5%',
    width: '80%',
    height: '40%',
    backgroundColor: NEBULA_BLUE,
    transform: [{ scaleX: 1.5 }],
  },
  // Warm lilac tint — bottom strip
  blobWarm: {
    left: '0%',
    bottom: '-5%',
    width: '100%',
    height: '20%',
    backgroundColor: BOTTOM_WARM,
    transform: [{ scaleX: 1.8 }],
  },
});
