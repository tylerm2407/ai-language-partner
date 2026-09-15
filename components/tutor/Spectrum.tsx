/**
 * Spectrum — the sound picture of the live call (Talk direction C1, canvas
 * page "Talk · C variations", picked 2026-09-08).
 *
 * A mirrored bar analyser: `bars` bars, tallest in the middle, each rising
 * and falling on its own beat while the tutor speaks, shimmering low while the
 * call listens, and resting when nothing is happening.
 *
 * ── WHAT DRIVES IT, HONESTLY ──
 *
 * The call has no amplitude meter yet: `useRealtimeTutor` exposes the phase
 * (a server-reported state — the tutor IS producing audio in `tutor_speaking`)
 * and not a level, and `CallStatusRing`'s `level` prop has never been fed by
 * the call screen. So this component is a TALKING INDICATOR keyed to the
 * phase, not a meter, and its motion is a pattern, not a measurement. That is
 * stated here rather than hidden so nobody reads the bars as "how loud".
 * `level`, when a caller does have one, scales the pattern — the same contract
 * the ring offers — and the day the session exposes per-band energy, the
 * pattern is what gets replaced.
 *
 * ── REDUCE MOTION ──
 *
 * Nothing moves. Each state renders as a static bar height (speaking tall,
 * listening mid, everything else low), which is the same information at a
 * coarser grain — the ring's rule, kept. The label under the bars is what
 * carries the state; this never does so alone.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useMotion } from '../../hooks/useMotion';

export type SpectrumState = 'idle' | 'preparing' | 'listening' | 'speaking' | 'stopped';

interface SpectrumProps {
  state: SpectrumState;
  /** Bar colour, already resolved for the scheme. */
  color: string;
  bars?: number;
  /** Height of the tallest bar at full scale. */
  height?: number;
  barWidth?: number;
  gap?: number;
  /** 0..1. Optional; scales the pattern when a caller has a real meter. */
  level?: number;
}

/** Bell across the row: the middle bars are the tall ones. 0.35..1. */
export function envelope(index: number, count: number): number {
  const centre = (count - 1) / 2;
  const spread = count / 4;
  return 0.35 + 0.65 * Math.exp(-(((index - centre) / spread) ** 2));
}

/** Deterministic per-bar jitter so the pattern reads as audio, not a metronome. */
function jitter(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Static heights for Reduce Motion, and the floor each moving state falls to. */
const REST: Record<SpectrumState, number> = {
  idle: 0.18,
  preparing: 0.18,
  listening: 0.3,
  speaking: 0.7,
  stopped: 0.12,
};

function Bar({
  index,
  count,
  state,
  color,
  height,
  width,
  level,
  shouldReduce,
}: {
  index: number;
  count: number;
  state: SpectrumState;
  color: string;
  height: number;
  width: number;
  level: number;
  shouldReduce: boolean;
}) {
  const env = envelope(index, count);
  const scale = useSharedValue(REST[state]);

  useEffect(() => {
    cancelAnimation(scale);
    if (shouldReduce) {
      scale.value = REST[state];
      return;
    }
    const gain = 0.4 + 0.6 * level;
    if (state === 'speaking') {
      const lo = 0.15 + 0.3 * jitter(index, 1);
      const dur = 550 + 600 * jitter(index, 2);
      const delay = 600 * jitter(index, 3);
      scale.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(gain, { duration: dur, easing: Easing.inOut(Easing.quad) }),
            withTiming(lo * gain, { duration: dur, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          true,
        ),
      );
      return;
    }
    if (state === 'listening' || state === 'preparing' || state === 'idle') {
      const lo = state === 'listening' ? 0.14 : 0.1;
      const hi = state === 'listening' ? 0.34 : 0.24;
      const delay = 900 * jitter(index, 4);
      scale.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(hi, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
            withTiming(lo, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
      return;
    }
    scale.value = withTiming(REST.stopped, { duration: 260 });
  }, [state, level, shouldReduce, index, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          width,
          height: Math.round(height * env),
          borderRadius: width / 2,
          backgroundColor: color,
          opacity: 0.55 + 0.45 * env,
        },
        style,
      ]}
    />
  );
}

export function Spectrum({
  state,
  color,
  bars = 28,
  height = 120,
  barWidth = 6,
  gap = 4,
  level,
}: SpectrumProps) {
  const { shouldReduce } = useMotion();
  const lvl = typeof level === 'number' && Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 1;
  return (
    <View
      style={[styles.row, { height, gap }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: bars }, (_, i) => (
        <Bar
          key={i}
          index={i}
          count={bars}
          state={state}
          color={color}
          height={height}
          width={barWidth}
          level={lvl}
          shouldReduce={shouldReduce}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  bar: {},
});
