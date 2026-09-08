/**
 * StepHero — the step's header block (Tint blocks, variant C "Hero block",
 * canvas page "Onboarding · composition", picked 2026-09-08; lesson variant B
 * "Hero card", canvas page "Lesson chrome · A/B", picked the same day).
 *
 * One violet block carries everything a step header used to split across two
 * rows: the leading control (back chevron, or a close × for a lesson), a
 * kicker ("STEP n OF total", or "GREETINGS & BASICS · QUESTION 03"), a
 * segmented progress strip, and the title itself — the question in
 * onboarding, the instruction or the verdict in a lesson. Sol peeks over the
 * block's bottom-right edge, playing his clips (idle loop, a nod on `cheer`).
 *
 * `tone` recolours the whole block: `primary` while a step is open, `green`
 * for a right answer, `error` for a wrong one. The change cross-fades rather
 * than snapping, because a lesson does it ten times.
 *
 * Depth comes from motion, not from strokes or shadows:
 *   - the block arrives with a per-step `entrance` (same vocabulary the
 *     bubble had, so each step still feels like its own moment);
 *   - the segments for the steps done so far light up one after another;
 *   - the title fades up a beat after the block lands;
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
 * - `none`: no entrance — for a block that stays mounted and only changes
 *   state, like the lesson hero between exercises.
 */
export type StepHeroEntrance = 'slide' | 'rise' | 'pop' | 'meet' | 'drop' | 'none';

export type StepHeroTone = 'primary' | 'green' | 'error';

interface StepHeroProps {
  /** One-based position; lights segments 1..step and drives the default kicker. */
  step: number;
  total: number;
  /** The title: the question, the instruction, or the verdict. */
  text: string;
  /** A second line under the title — the explanation on a verdict. */
  subtitle?: string;
  /** Replaces "Step n of total". */
  kicker?: string;
  /**
   * Segments lit fully. Defaults to `step`, which is right when every step
   * before this one is done; a lesson passes its answered count instead,
   * because a learner can walk back onto an answered exercise.
   */
  done?: number;
  onBack?: () => void;
  /** `close` swaps the back chevron for an ×. */
  leading?: 'back' | 'close';
  leadingLabel?: string;
  tone?: StepHeroTone;
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
    case 'none':
      return {};
  }
}

const SOL_SIZE = 72;
const SEGMENT_STAGGER_MS = 70;
const TONE_FADE_MS = 260;

function Segment({
  index,
  state,
  colour,
  shouldReduce,
}: {
  index: number;
  /** `done` full, `current` half, `todo` faint. */
  state: 'done' | 'current' | 'todo';
  colour: string;
  shouldReduce: boolean;
}) {
  const target = state === 'done' ? 1 : state === 'current' ? 0.6 : 0.3;
  const on = useSharedValue(shouldReduce ? target : 0.3);
  useEffect(() => {
    if (shouldReduce) {
      on.value = target;
      return;
    }
    on.value = withDelay(220 + index * SEGMENT_STAGGER_MS, withTiming(target, { duration: 260 }));
  }, [target, index, shouldReduce, on]);
  const style = useAnimatedStyle(() => ({ opacity: on.value }));
  return <Animated.View style={[styles.segment, { backgroundColor: colour }, style]} />;
}

export function StepHero({
  step,
  total,
  text,
  subtitle,
  kicker,
  done,
  onBack,
  leading = 'back',
  leadingLabel,
  tone = 'primary',
  mood = 'idle',
  entrance = 'slide',
}: StepHeroProps) {
  const { c, type, shape } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const anim: EntranceSet = shouldReduce ? {} : buildEntrance(entrance);

  const fill =
    tone === 'green'
      ? { bg: c.green, fg: c.onGreen, fg2: c.onGreen }
      : tone === 'error'
        ? { bg: c.error, fg: c.onError, fg2: c.onError }
        : { bg: c.primary, fg: c.onPrimary, fg2: c.onPrimaryMuted };

  // Tone cross-fade. Reanimated interpolates colour strings, so the block
  // slides from violet to green rather than blinking.
  const bg = useSharedValue(fill.bg);
  useEffect(() => {
    bg.value = shouldReduce ? fill.bg : withTiming(fill.bg, { duration: TONE_FADE_MS });
  }, [fill.bg, shouldReduce, bg]);
  const bgStyle = useAnimatedStyle(() => ({ backgroundColor: bg.value }));

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

  const lit = done ?? step;
  const segments = Array.from({ length: total }, (_, i) => i + 1);
  const segmentState = (n: number): 'done' | 'current' | 'todo' =>
    n <= lit && n !== step ? 'done' : n === step ? (n <= lit ? 'done' : 'current') : 'todo';

  const label = leadingLabel ?? (leading === 'close' ? 'Exit lesson' : 'Back');
  const textEntering = shouldReduce ? undefined : FadeInUp.delay(90).duration(320);

  // Back sits on the left where iOS puts it; a close × sits on the right
  // where a sheet's does. The kicker takes whichever side is free.
  const control = (
    <Pressable
      onPress={() => {
        haptic('buttonPress');
        onBack?.();
      }}
      disabled={!onBack}
      hitSlop={8}
      style={[styles.control, leading === 'close' ? styles.controlRight : styles.controlLeft, { opacity: onBack ? 1 : 0 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityElementsHidden={!onBack}
    >
      <Ionicons name={leading === 'close' ? 'close' : 'chevron-back'} size={22} color={fill.fg} />
    </Pressable>
  );
  const kickerText = (
    <Text
      style={[styles.kicker, leading === 'close' ? styles.kickerLeft : styles.kickerRight, { fontFamily: type.uiHeavy, color: fill.fg2 }]}
      numberOfLines={1}
    >
      {kicker ?? `Step ${step} of ${total}`}
    </Text>
  );

  return (
    <Animated.View entering={anim.block} style={styles.wrap}>
      <Animated.View style={[styles.block, { borderRadius: shape.radiusHero }, bgStyle]}>
        <View style={styles.topRow}>
          {leading === 'close' ? kickerText : control}
          {leading === 'close' ? control : kickerText}
        </View>

        <View
          style={styles.segments}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: step }}
          accessibilityLabel={`${step} of ${total}`}
        >
          {segments.map((n) => (
            <Segment key={n} index={n - 1} state={segmentState(n)} colour={fill.fg} shouldReduce={shouldReduce} />
          ))}
        </View>

        {/* Keyed on the copy so a verdict replacing the instruction fades up
            like a new step, instead of the old words being overwritten. */}
        <Animated.View key={`${tone}:${text}`} entering={textEntering} style={styles.copy}>
          <Text
            accessibilityRole="header"
            accessibilityLiveRegion={tone === 'primary' ? 'none' : 'polite'}
            style={[styles.title, { fontFamily: type.heading, color: fill.fg }]}
          >
            {text}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { fontFamily: type.ui, color: fill.fg2 }]}>{subtitle}</Text>
          ) : null}
        </Animated.View>
      </Animated.View>

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
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  kicker: { flex: 1, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  kickerLeft: { textAlign: 'left' },
  kickerRight: { textAlign: 'right' },
  control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  controlLeft: { marginLeft: -14 },
  controlRight: { marginRight: -14 },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  copy: { gap: 8, paddingRight: SOL_SIZE - 8 },
  title: { fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  sol: { position: 'absolute', right: 10, bottom: -14, width: SOL_SIZE, height: SOL_SIZE },
});
