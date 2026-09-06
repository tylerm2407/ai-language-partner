/**
 * PlanBuilder — the payoff loader between the trial lesson and the save ask.
 *
 * A bar grows over ~2.4s while three stages tick off; Sol thinks, then cheers
 * as the last one lands. The real work (profile write, first-lesson pick)
 * already happened or happens on the flush; this screen exists so the level
 * result arrives as something built rather than something looked up. If the
 * caller finishes early the bar still completes — the timing is the point.
 *
 * `onDone` fires once, after the last stage has been visible for a beat.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { MascotSol } from './MascotSol';
import { haptic } from '../../lib/haptics';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface PlanBuilderProps {
  stages: string[];
  onDone: () => void;
  /** Total run time. Reduce Motion collapses it to a short beat. */
  durationMs?: number;
}

export const PLAN_BUILDER_MS = 2400;

export function PlanBuilder({ stages, onDone, durationMs = PLAN_BUILDER_MS }: PlanBuilderProps) {
  const { c, type } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const total = shouldReduce ? 600 : durationMs;
  const [done, setDone] = useState(0);
  const width = useSharedValue(0.08);
  const firedRef = useRef(false);

  useEffect(() => {
    width.value = withTiming(1, { duration: total, easing: Easing.out(Easing.cubic) });
    const timers = stages.map((_, i) =>
      setTimeout(() => {
        setDone(i + 1);
        haptic('select');
      }, Math.round((total * (i + 1)) / stages.length)),
    );
    const finish = setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      onDone();
    }, total + 500);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
    // Runs once per mount by design: restarting the bar on a re-render would
    // replay the whole sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  const allDone = done >= stages.length;

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <MascotSol size={130} mood={allDone ? 'cheer' : 'think'} />
      <Text style={{ fontFamily: type.heading, fontSize: 28, lineHeight: 34, color: c.ink, textAlign: 'center' }}>
        Building your plan
      </Text>
      <View style={[styles.track, { backgroundColor: c.track }]} accessibilityRole="progressbar">
        <Animated.View style={[styles.fill, { backgroundColor: c.primary }, fill]} />
      </View>
      <View style={styles.stages}>
        {stages.map((label, i) => {
          const state = i < done ? 'done' : i === done ? 'active' : 'pending';
          return (
            <Animated.View
              key={label}
              entering={shouldReduce ? undefined : FadeInDown.delay(120 + i * 80).duration(320)}
              style={styles.stage}
            >
              {state === 'done' ? (
                <View style={[styles.dot, { backgroundColor: c.green }]}>
                  <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                </View>
              ) : (
                <View
                  style={[
                    styles.dot,
                    styles.ring,
                    { borderColor: c.track, borderTopColor: state === 'active' ? c.primary : c.track },
                  ]}
                />
              )}
              <Text
                style={{
                  fontFamily: type.uiBold,
                  fontSize: 15,
                  color: state === 'pending' ? c.muted : c.ink,
                }}
              >
                {label}
              </Text>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: 28 },
  track: { alignSelf: 'stretch', height: 14, borderRadius: 7, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 7 },
  stages: { alignSelf: 'stretch', gap: 14, paddingHorizontal: 12 },
  stage: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 3 },
});
