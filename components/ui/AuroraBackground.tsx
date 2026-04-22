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
const BASE_TOP = '#08081a';
const BASE_MID = '#0d0e25';
const BASE_BOT = '#110a28';

const NEBULA_PURPLE = 'rgba(60, 20, 120, 0.55)';
const NEBULA_BLUE = 'rgba(30, 50, 100, 0.30)';
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
  warm: boolean;
}

function generateStars(count: number): StarData[] {
  const stars: StarData[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * SCREEN_W,
      y: Math.random() * SCREEN_H,
      size: 0.8 + Math.random() * 1.4,
      baseOpacity: 0.15 + Math.random() * 0.55,
      delay: Math.random() * 8000,
      duration: 5000 + Math.random() * 7000, // slower twinkle: 5–12s
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

// ── Circular orbit hook ──────────────────────────────────────
// Two independent sine waves with different periods create a
// Lissajous / orbital path that feels organic and non-repeating.
function useOrbit(xPeriod: number, yPeriod: number, delay: number) {
  const phaseX = useSharedValue(0);
  const phaseY = useSharedValue(0);

  useEffect(() => {
    phaseX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: xPeriod / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(-1, { duration: xPeriod / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: xPeriod / 4, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    phaseY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-1, { duration: yPeriod / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: yPeriod / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: yPeriod / 4, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [phaseX, phaseY, xPeriod, yPeriod, delay]);

  return { phaseX, phaseY };
}

// ── Nebula Glow — slow circular orbits + breathing ───────────
function NebulaGlow() {
  const breathe = useSharedValue(0);

  // Each blob gets its own orbital path with different X/Y periods
  // so they move independently and feel random
  const purpleOrbit = useOrbit(28000, 36000, 0);      // ~28s X, ~36s Y
  const blueOrbit = useOrbit(34000, 24000, 4000);     // ~34s X, ~24s Y — offset start
  const warmOrbit = useOrbit(40000, 30000, 8000);     // ~40s X, ~30s Y — offset start

  useEffect(() => {
    // Very slow breathing — 24s full cycle
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 12000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 12000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [breathe]);

  const purpleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.65, 1.0]),
    transform: [
      { translateX: purpleOrbit.phaseX.value * 18 },
      { translateY: purpleOrbit.phaseY.value * 14 },
    ],
  }));

  const blueStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.55, 0.85]),
    transform: [
      { translateX: blueOrbit.phaseX.value * 14 },
      { translateY: blueOrbit.phaseY.value * 10 },
    ],
  }));

  const warmStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.4, 0.75]),
    transform: [
      { translateX: warmOrbit.phaseX.value * 10 },
      { translateY: warmOrbit.phaseY.value * 6 },
    ],
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
      {/* Layer 0: Vertical gradient */}
      <LinearGradient
        colors={[BASE_TOP, BASE_MID, BASE_BOT]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Layer 1: Nebula glow blobs (slow circular orbits + breathe) */}
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
  blobPurple: {
    right: '-20%',
    top: '35%',
    width: '110%',
    height: '45%',
    backgroundColor: NEBULA_PURPLE,
    transform: [{ scaleX: 1.3 }],
  },
  blobBlue: {
    left: '-15%',
    top: '5%',
    width: '80%',
    height: '40%',
    backgroundColor: NEBULA_BLUE,
    transform: [{ scaleX: 1.5 }],
  },
  blobWarm: {
    left: '0%',
    bottom: '-5%',
    width: '100%',
    height: '20%',
    backgroundColor: BOTTOM_WARM,
    transform: [{ scaleX: 1.8 }],
  },
});
