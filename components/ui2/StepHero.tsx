/**
 * StepHero — the onboarding step's header block (Tint blocks, variant C
 * "Hero block", canvas page "Onboarding · composition", picked 2026-09-08).
 *
 * One violet block carries everything the old StepHeader + SpeechBubble pair
 * split across two rows: the back chevron, "STEP n OF total", a segmented
 * progress strip, and the question itself. Sol peeks over the block's
 * bottom-right edge, playing his clips (idle loop, a nod on `cheer`).
 *
 * Depth comes from motion, not from strokes or shadows:
 *   - the block arrives with a per-step `entrance` (same vocabulary the
 *     bubble had, so each step still feels like its own moment);
 *   - the segments for the steps done so far light up one after another;
 *   - the question fades up a beat after the block lands;
 *   - Sol pops in last and then bobs on a slow loop.
 * Every piece gates on Reduce Motion and settles to its final state at once.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  SlideInRight,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type BaseAnimationBuilder,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { MascotSol, type MascotMood } from './MascotSol';

/**
 * - `slide`: the block springs in from the right, Sol pops up after it.
 * - `rise`: the block floats up, Sol fades in — for a reflective ask.
 * - `pop`: block and Sol both pop to size — a quick, confident question.
 * - `meet`: the block drifts in from the left, Sol from the right.
 * - `drop`: the block settles down from above, Sol drops in after.
 */
export type StepHeroEntrance = 'slide' | 'rise' | 'pop' | 'meet' | 'drop';

interface StepHeroProps {
  step: number;
  total: number;
  text: string;
  onBack?: () => void;
  mood?: MascotMood;
  entrance?: StepHeroEntrance;
}

interface EntranceSet {
  block?: BaseAnimationBuilder;
  sol?: BaseAnimationBuilder;
}

function buildEntrance(entrance: StepHeroEntrance): EntranceSet {
  switch (entrance) {
    case 'slide':
      return {
        block: SlideInRight.springify().damping(18).stiffness(170),
        sol: ZoomIn.delay(160).springify().damping(12).stiffness(220),
      };
    case 'rise':
      return {
        block: FadeInUp.springify().damping(16).stiffness(150),
        sol: FadeIn.delay(180).duration(320),
      };
    case 'pop':
      return {
        block: ZoomIn.springify().damping(14).stiffness(200),
        sol: ZoomIn.delay(120).springify().damping(12).stiffness(220),
      };
    case 'meet':
      return {
        block: FadeInLeft.springify().damping(17).stiffness(160),
        sol: FadeInRight.delay(100).springify().damping(17).stiffness(160),
      };
    case 'drop':
      return {
        block: FadeInDown.springify().damping(15).stiffness(180),
        sol: FadeInDown.delay(140).springify().damping(13).stiffness(190),
      };
  }
}

const SOL_SIZE = 72;
const SEGMENT_STAGGER_MS = 70;

function Segment({ index, lit, shouldReduce }: { index: number; lit: boolean; shouldReduce: boolean }) {
  const { c } = useUi2Theme();
  const on = useSharedValue(shouldReduce || !lit ? (lit ? 1 : 0) : 0);
  useEffect(() => {
    if (shouldReduce) {
      on.value = lit ? 1 : 0;
      return;
    }
    on.value = lit ? withDelay(220 + index * SEGMENT_STAGGER_MS, withTiming(1, { duration: 260 })) : 0;
  }, [lit, index, shouldReduce, on]);
  const style = useAnimatedStyle(() => ({ opacity: 0.3 + on.value * 0.7 }));
  return <Animated.View style={[styles.segment, { backgroundColor: c.onPrimary }, style]} />;
}

export function StepHero({ step, total, text, onBack, mood = 'idle', entrance = 'slide' }: StepHeroProps) {
  const { c, type, shape } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const anim: EntranceSet = shouldReduce ? {} : buildEntrance(entrance);

  // Sol's slow bob: 4px, 3.2s round trip. The clips animate his face; this
  // moves his whole body against the block, which is what reads as depth.
  const bob = useSharedValue(0);
  useEffect(() => {
    if (shouldReduce) {
      bob.value = 0;
      return;
    }
    bob.value = withRepeat(
      withSequence(withTiming(-4, { duration: 1600 }), withTiming(0, { duration: 1600 })),
      -1,
      false,
    );
  }, [shouldReduce, bob]);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  const segments = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <Animated.View entering={anim.block} style={styles.wrap}>
      <View style={[styles.block, { backgroundColor: c.primary, borderRadius: shape.radiusHero }]}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              haptic('buttonPress');
              onBack?.();
            }}
            disabled={!onBack}
            style={[styles.back, { opacity: onBack ? 1 : 0 }]}
            accessibilityRole="button"
            accessibilityLabel="Back"
            accessibilityElementsHidden={!onBack}
          >
            <Ionicons name="chevron-back" size={22} color={c.onPrimary} />
          </Pressable>
          <Text style={[styles.stepLabel, { fontFamily: type.uiHeavy, color: c.onPrimaryMuted }]}>
            Step {step} of {total}
          </Text>
        </View>

        <View
          style={styles.segments}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: step }}
        >
          {segments.map((n) => (
            <Segment key={n} index={n - 1} lit={n <= step} shouldReduce={shouldReduce} />
          ))}
        </View>

        <Animated.Text
          entering={shouldReduce ? undefined : FadeInUp.delay(90).duration(320)}
          accessibilityRole="header"
          style={[styles.question, { fontFamily: type.heading, color: c.onPrimary }]}
        >
          {text}
        </Animated.Text>
      </View>

      {/* Outside the block so nothing clips him, positioned to overlap its
          bottom-right edge. The clips are alpha video, so he sits on the
          violet and on the ground below without a box. */}
      <Animated.View entering={anim.sol} style={[styles.sol, bobStyle]} pointerEvents="none">
        <MascotSol size={SOL_SIZE} mood={mood} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', marginBottom: 6 },
  block: { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 22, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -14 },
  stepLabel: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  question: { fontSize: 24, lineHeight: 30, letterSpacing: -0.4, paddingRight: SOL_SIZE - 8 },
  sol: { position: 'absolute', right: 10, bottom: -14, width: SOL_SIZE, height: SOL_SIZE },
});
