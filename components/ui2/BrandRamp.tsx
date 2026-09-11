/**
 * BrandRamp — the app icon's colour ramp as a gradient, in the few places
 * Home lets the logo show (canvas "Home · logo colours", S1 · Quiet, picked
 * 2026-09-10 with G1's tab bar).
 *
 * The ramp is deliberately thin on the page: a 4px line under the level, the
 * fill of each unit's progress bar, a slim mark beside today's read, the
 * week's bars and the active tab disc. Cards themselves stay one neutral
 * fill — "the brand shows in the lines, not the blocks". Everything here
 * reads the four `logo*` tokens through the palette so the reader's warm
 * variant (which never shows Home) still gets a blue-free key set.
 *
 * ── THE SWELL (canvas "Home · motion", W3, picked 2026-09-11) ──
 *
 * Every ramp line breathes: a gradient twice the fill's width slides along
 * it and back over `FLOW_MS` (Tyler asked for the canvas take slowed down,
 * so 5 s each way), and at the far end of each pass the fill brightens and
 * throws a soft violet glow. Rows are staggered by `phase` so a stack of
 * bars does not pulse in unison. It is three loops on one shared value —
 * translateX, an overlay's opacity, a shadow's opacity — nothing re-renders
 * per frame. Reduce Motion shows the still gradient.
 *
 * The glow lives on an OUTER view and the sliding gradient is clipped by an
 * INNER one: iOS clips a view's own shadow when it has `overflow: hidden`,
 * so one view cannot both clip and glow. The glow is iOS-only — Android's
 * elevation shadow cannot animate its opacity — so Android gets the flow
 * and the brightening, not the halo.
 */
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { Ui2Palette } from '../../config/theme';

/** Cyan → sky → violet → magenta, the icon left to right. */
export function brandRamp(c: Ui2Palette): readonly [string, string, string, string] {
  return [c.logoAqua, c.logoSky, c.logoViolet, c.logoMagenta];
}

/** The icon's cool half (the left bubble). */
export function brandRampCool(c: Ui2Palette): readonly [string, string] {
  return [c.logoSky, c.logoAqua];
}

/** The icon's warm half (the right bubble). */
export function brandRampWarm(c: Ui2Palette): readonly [string, string] {
  return [c.logoViolet, c.logoMagenta];
}

/** 0–100, clamped; anything else (NaN, undefined progress) reads as 0. */
export function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

/** One pass of the wave, each way. The canvas take was 3.6 s; Tyler asked for slower. */
export const FLOW_MS = 5000;

/** How bright the fill gets at the top of a swell (a white veil's opacity). */
const SWELL_BRIGHTEN = 0.22;
/** Peak opacity of the violet halo. */
const SWELL_GLOW = 0.65;

/**
 * The glow's shape over one pass: 0 at the start, 1 at the far end, so the
 * bar is brightest exactly when its colours have travelled furthest. Pure,
 * and a worklet, so both the JS test and the UI thread can call it.
 */
export function swellAt(t: number): number {
  'worklet';
  return Math.sin(Math.min(1, Math.max(0, t)) * (Math.PI / 2));
}

interface SwellFillProps {
  /** Width of the fill: a percentage of the track, or the whole line. */
  width: `${number}%`;
  height: number;
  /** 0–1: a fraction of one pass to hold back before this bar starts, so stacked bars are out of step. */
  phase: number;
}

/** The animated ramp fill shared by the bar and the rule. */
function SwellFill({ width, height, phase }: SwellFillProps) {
  const { c } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const [w, setW] = useState(0);
  const t = useSharedValue(0);

  useEffect(() => {
    if (shouldReduce) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = 0;
    t.value = withDelay(
      Math.max(0, phase) * FLOW_MS,
      withRepeat(withTiming(1, { duration: FLOW_MS, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => cancelAnimation(t);
  }, [shouldReduce, phase, t]);

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateX: -t.value * w }] }));
  const veil = useAnimatedStyle(() => ({ opacity: SWELL_BRIGHTEN * swellAt(t.value) }));
  const halo = useAnimatedStyle(() => ({ shadowOpacity: SWELL_GLOW * swellAt(t.value) }));

  const radius = height / 2;
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));

  if (shouldReduce) {
    return (
      <LinearGradient
        colors={brandRamp(c)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width, height, borderRadius: radius }}
      />
    );
  }

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        { width, height, borderRadius: radius, backgroundColor: c.logoViolet },
        Platform.OS === 'ios' ? [styles.haloBase, { shadowColor: c.logoViolet }, halo] : null,
      ]}
    >
      <View style={[styles.clip, { borderRadius: radius }]}>
        {w > 0 ? (
          <Animated.View style={[styles.sheet, { width: w * 2, height }, sheet]}>
            <LinearGradient colors={brandRamp(c)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        ) : (
          <LinearGradient colors={brandRamp(c)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        )}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.onPrimary }, veil]} />
      </View>
    </Animated.View>
  );
}

interface RampBarProps {
  /** Percent filled, 0–100. */
  pct: number;
  height?: number;
  /** The groove: on a card the ground colour, on the ground the card colour. */
  onCard?: boolean;
  /** Stagger, 0–1 of a pass. Give each bar in a stack a different value. */
  phase?: number;
  style?: ViewStyle;
}

/** A thin progress line whose fill is the full ramp, breathing. */
export function RampBar({ pct, height = 4, onCard = true, phase = 0, style }: RampBarProps) {
  const { c } = useUi2Theme();
  const width = clampPct(pct);
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: onCard ? c.trackOnCard : c.card }, style]}>
      {width > 0 ? <SwellFill width={`${width}%`} height={height} phase={phase} /> : null}
    </View>
  );
}

/** A full-width ramp rule — decoration, not data — breathing like the bars. */
export function RampRule({ height = 4, phase = 0, style }: { height?: number; phase?: number; style?: ViewStyle }) {
  return (
    <View style={style}>
      <SwellFill width="100%" height={height} phase={phase} />
    </View>
  );
}

/** A slim vertical mark in the warm half — the read row's badge. Still. */
export function RampMark({ height = 36, width = 4 }: { height?: number; width?: number }) {
  const { c } = useUi2Theme();
  return (
    <LinearGradient
      colors={brandRampWarm(c)}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ width, height, borderRadius: width / 2 }}
    />
  );
}

const styles = StyleSheet.create({
  // No `overflow: hidden` here on purpose: the fill's halo has to escape the
  // groove, and the fill carries its own radius so nothing needs clipping.
  track: { width: '100%' },
  clip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  sheet: { position: 'absolute', left: 0, top: 0 },
  haloBase: { shadowOffset: { width: 0, height: 0 }, shadowRadius: 6, shadowOpacity: 0 },
});
