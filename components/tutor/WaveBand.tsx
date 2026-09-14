/**
 * WaveBand — the lobby's stage ("Talk · Wave", picked 2026-09-14).
 *
 * Three stacked waves drift across the top of the Talk tab: two tints going
 * left, the violet one going right, so the surface reads as water rather than
 * a pattern. The portrait sits on the crest and bobs. The violet wave fills to
 * the bottom of the band, and the block under it continues in `primary`, so
 * the band's bottom edge is invisible and the portrait appears to float on the
 * top of the violet.
 *
 * Motion is a `translateX` loop on the UI thread (Reanimated) — nothing is
 * re-rendered per frame. Under Reduce Motion every wave and the portrait hold
 * still; the shapes stay, only the drift goes.
 */
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { PORTRAIT_DIAMETER } from './TutorPortrait';

export const WAVE_BAND_HEIGHT = 140;
/** How far the portrait's bottom hangs below the band, into the block beneath. */
const PORTRAIT_TOP = 30;
export const WAVE_PORTRAIT_OVERHANG = PORTRAIT_TOP + PORTRAIT_DIAMETER.hero - WAVE_BAND_HEIGHT;

/**
 * One period of a sine-like wave, drawn twice so a shift of `w` loops
 * seamlessly. `mid` is the resting line, `amp` the crest height above it; the
 * path closes down to the band's bottom so it fills, not strokes.
 */
export function wavePath(w: number, mid: number, amp: number, height: number): string {
  const q = w / 4;
  const c1 = w / 6;
  const c2 = w / 3;
  const half = (x0: number, up: boolean) => {
    const y = up ? mid - amp : mid + amp;
    return `C ${x0 + c1} ${y}, ${x0 + c2} ${y}, ${x0 + 2 * q} ${mid}`;
  };
  let d = `M0 ${mid} `;
  for (let i = 0; i < 2; i++) {
    const x0 = i * w;
    d += `${half(x0, true)} ${half(x0 + 2 * q, false)} `;
  }
  return `${d}V${height} H0 Z`;
}

interface WaveLayerProps {
  color: string;
  opacity?: number;
  /** Seconds per full loop; negative drifts the other way. */
  seconds: number;
  mid: number;
  amp: number;
}

function WaveLayer({ color, opacity = 1, seconds, mid, amp }: WaveLayerProps) {
  const { width } = useWindowDimensions();
  const { shouldReduce } = useMotion();
  const x = useSharedValue(0);
  const forward = seconds > 0;

  useEffect(() => {
    if (shouldReduce) {
      x.value = 0;
      return;
    }
    // From 0 to -width (or -width to 0), forever, linear so the loop is invisible.
    x.value = forward ? 0 : -width;
    x.value = withRepeat(
      withTiming(forward ? -width : 0, { duration: Math.abs(seconds) * 1000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [shouldReduce, width, seconds, forward, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { width: width * 2 }, style]}>
      <Svg width={width * 2} height={WAVE_BAND_HEIGHT}>
        <Path d={wavePath(width, mid, amp, WAVE_BAND_HEIGHT)} fill={color} fillOpacity={opacity} />
      </Svg>
    </Animated.View>
  );
}

interface WaveBandProps {
  /** The tutor portrait (or a spinner while the persona loads). */
  children?: ReactNode;
}

export function WaveBand({ children }: WaveBandProps) {
  const { c } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const bob = useSharedValue(0);

  useEffect(() => {
    if (shouldReduce) {
      bob.value = 0;
      return;
    }
    bob.value = withRepeat(withTiming(-5, { duration: 2250, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [shouldReduce, bob]);

  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  return (
    <View style={styles.band}>
      <View style={styles.water} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <WaveLayer color={c.primaryTint} seconds={9} mid={70} amp={50} />
        <WaveLayer color={c.primaryTintBorder} opacity={0.8} seconds={9} mid={90} amp={50} />
        <WaveLayer color={c.primary} seconds={-12} mid={110} amp={40} />
      </View>
      <Animated.View style={[styles.portrait, bobStyle]}>
        <View style={[styles.ring, { backgroundColor: c.bg }]}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    height: WAVE_BAND_HEIGHT,
    // The portrait hangs below the band on purpose; the block beneath leaves
    // room for it (WAVE_PORTRAIT_OVERHANG).
    overflow: 'visible',
    zIndex: 2,
  },
  water: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  portrait: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PORTRAIT_TOP,
    alignItems: 'center',
  },
  ring: {
    padding: 4,
    borderRadius: 999,
  },
});
