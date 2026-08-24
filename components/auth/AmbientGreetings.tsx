import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { useMotion } from '../../hooks/useMotion';
import { typography } from '../../config/theme';

/**
 * Ambient greeting words drifting behind the auth screen — the texture layer
 * that sits between the glow gradients and the form.
 *
 * Deliberately decorative: `pointerEvents="none"` and
 * `accessibilityElementsHidden` so it never takes a tap or reaches a screen
 * reader. Max alpha is 0.13, which keeps every real text element above it
 * comfortably AA on `surface.base`.
 *
 * Apple's Reduced Motion criteria calls out multi-axis motion specifically,
 * which is exactly what this is — so under Reduce Motion the words render
 * static rather than animating on a shorter path.
 */

interface Word {
  text: string;
  /** Fractions of the frame, so this works on any device height. */
  x: number;
  y: number;
  size: number;
  color: string;
  /** Seconds for one full loop. */
  duration: number;
  /** Fraction of the loop to start at, so no two words ever sync. */
  offset: number;
  path: 'a' | 'b' | 'c';
}

const WORDS: Word[] = [
  { text: 'Bonjour', x: -0.04, y: 0.05, size: 40, color: 'rgba(241,245,249,0.07)', duration: 23, offset: 0, path: 'a' },
  { text: 'Ciao', x: 0.72, y: 0.25, size: 34, color: 'rgba(129,140,248,0.13)', duration: 27, offset: 0.19, path: 'b' },
  { text: 'こんにちは', x: 0.02, y: 0.34, size: 46, color: 'rgba(241,245,249,0.06)', duration: 21, offset: 0.52, path: 'c' },
  { text: 'Olá', x: 0.76, y: 0.47, size: 36, color: 'rgba(168,85,247,0.13)', duration: 29, offset: 0.1, path: 'a' },
  { text: 'Привет', x: -0.03, y: 0.58, size: 38, color: 'rgba(241,245,249,0.065)', duration: 24, offset: 0.62, path: 'b' },
  { text: 'Hallo', x: 0.7, y: 0.7, size: 42, color: 'rgba(129,140,248,0.11)', duration: 25, offset: 0.28, path: 'c' },
  { text: 'Hola', x: 0.04, y: 0.83, size: 36, color: 'rgba(241,245,249,0.06)', duration: 20, offset: 0.85, path: 'a' },
];

/** Keyframe tracks, one per path. `t` is 0-1 through the loop. */
const PATHS = {
  a: {
    x: [0, 26, -14, 18, 0],
    y: [0, -34, -52, -22, 0],
    rotate: ['-2.5deg', '1.5deg', '3deg', '-1deg', '-2.5deg'],
    opacity: [0.5, 1, 0.75, 1, 0.5],
    t: [0, 0.25, 0.55, 0.8, 1],
  },
  b: {
    x: [0, -30, 16, -10, 0],
    y: [0, 26, 48, 18, 0],
    rotate: ['2deg', '-2deg', '-4deg', '1deg', '2deg'],
    opacity: [0.85, 0.45, 1, 0.7, 0.85],
    t: [0, 0.3, 0.6, 0.85, 1],
  },
  c: {
    x: [0, 38, 20, 0],
    y: [0, -16, 30, 0],
    rotate: ['0deg', '2.5deg', '-2deg', '0deg'],
    opacity: [0.6, 1, 0.5, 0.6],
    t: [0, 0.4, 0.7, 1],
  },
} as const;

function DriftingWord({ word, frameW, frameH }: { word: Word; frameW: number; frameH: number }) {
  const { shouldReduce } = useMotion();
  const progress = useRef(new Animated.Value(word.offset)).current;

  useEffect(() => {
    if (shouldReduce) return;

    // Run offset → 1, then loop 0 → 1 forever, so each word enters its cycle
    // at a different point without a visible jump on the first pass.
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: word.duration * 1000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    const lead = Animated.timing(progress, {
      toValue: 1,
      duration: word.duration * 1000 * (1 - word.offset),
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    });

    lead.start(({ finished }) => {
      if (!finished) return;
      progress.setValue(0);
      loop.start();
    });

    return () => {
      lead.stop();
      loop.stop();
    };
  }, [shouldReduce, progress, word.duration, word.offset]);

  const track = PATHS[word.path];
  const interp = (out: readonly (number | string)[]) =>
    progress.interpolate({ inputRange: track.t as unknown as number[], outputRange: out as never });

  const staticStyle = { opacity: track.opacity[0] };
  const animatedStyle = {
    opacity: interp(track.opacity),
    transform: [
      { translateX: interp(track.x) },
      { translateY: interp(track.y) },
      { rotate: interp(track.rotate) },
    ],
  };

  return (
    <Animated.View
      style={[
        { position: 'absolute', left: word.x * frameW, top: word.y * frameH },
        shouldReduce ? staticStyle : animatedStyle,
      ]}
    >
      <Text style={{ fontFamily: typography.family.serif, fontSize: word.size, color: word.color }}>
        {word.text}
      </Text>
    </Animated.View>
  );
}

export function AmbientGreetings() {
  const { width, height } = useWindowDimensions();

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
    >
      {WORDS.map((word) => (
        <DriftingWord key={word.text} word={word} frameW={width} frameH={height} />
      ))}
    </View>
  );
}
