/**
 * MascotSol — the code-only stand-in for the mascot.
 *
 * An artist is producing the real character (2026-09-06); when it lands this
 * becomes a Rive state machine with the same `mood` API, so screens do not
 * change. Until then: an SVG blob that bobs, blinks, and reacts.
 *
 *   idle   — slow bob, blink every ~4.5s
 *   think  — head tilt, held
 *   cheer  — one squash-and-jump, then back to idle
 *
 * All motion gates on Reduce Motion, in which case it is a still image.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';

export type MascotMood = 'idle' | 'think' | 'cheer';

interface MascotSolProps {
  size?: number;
  mood?: MascotMood;
  /** Optional body tint (identity step recolours Sol to the chosen look). */
  tint?: string;
}

const AnimatedG = Animated.createAnimatedComponent(G);

export function MascotSol({ size = 96, mood = 'idle', tint }: MascotSolProps) {
  const { c } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const bob = useSharedValue(0);
  const tilt = useSharedValue(0);
  const jump = useSharedValue(0);
  const blink = useSharedValue(1);

  useEffect(() => {
    if (shouldReduce) {
      cancelAnimation(bob);
      cancelAnimation(blink);
      bob.value = 0;
      blink.value = 1;
      return;
    }
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    blink.value = withRepeat(
      withSequence(
        withDelay(4200, withTiming(0.1, { duration: 70 })),
        withTiming(1, { duration: 110 }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(bob);
      cancelAnimation(blink);
    };
  }, [shouldReduce, bob, blink]);

  useEffect(() => {
    if (shouldReduce) {
      tilt.value = 0;
      jump.value = 0;
      return;
    }
    tilt.value = withSpring(mood === 'think' ? 1 : 0, { damping: 14, stiffness: 160 });
    if (mood === 'cheer') {
      jump.value = withSequence(
        withTiming(-0.35, { duration: 110, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 9, stiffness: 260, mass: 0.7 }),
        withTiming(0, { duration: 260, easing: Easing.inOut(Easing.quad) }),
      );
    } else {
      jump.value = withTiming(0, { duration: 200 });
    }
  }, [mood, shouldReduce, tilt, jump]);

  const bodyStyle = useAnimatedStyle(() => {
    // A jump squashes on the way down (negative) and stretches at the top.
    const j = jump.value;
    const squash = j < 0 ? 1 + j * 0.5 : 1;
    const stretch = j > 0 ? 1 + j * 0.12 : 1;
    return {
      transform: [
        { translateY: -8 * bob.value - 22 * Math.max(j, 0) },
        { rotate: `${-2 + 4 * bob.value + 10 * tilt.value}deg` },
        { scaleY: squash * stretch },
        { scaleX: j < 0 ? 1 - j * 0.3 : 1 / stretch },
      ],
    };
  });
  const eyeProps = useAnimatedProps(() => ({ scaleY: blink.value }));

  const body = tint ?? c.primary;

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
      <Animated.View style={[{ width: size, height: size, transformOrigin: '50% 90%' }, bodyStyle]}>
        <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
          <Path d="M22 14 L30 30 L14 30 Z" fill="#C084FC" />
          <Path d="M74 14 L82 30 L66 30 Z" fill="#C084FC" />
          <Rect x="14" y="24" width="68" height="62" rx="30" fill={body} />
          <Ellipse cx="48" cy="70" rx="20" ry="14" fill="#C4B5FD" opacity={0.9} />
          <AnimatedG animatedProps={eyeProps} originX={48} originY={48}>
            <Circle cx="36" cy="48" r="7" fill="#FFFFFF" />
            <Circle cx="37" cy="49" r="3.5" fill="#B45309" />
            <Circle cx="38" cy="47.5" r="1.2" fill="#FFFFFF" />
            <Circle cx="60" cy="48" r="7" fill="#FFFFFF" />
            <Circle cx="61" cy="49" r="3.5" fill="#B45309" />
            <Circle cx="62" cy="47.5" r="1.2" fill="#FFFFFF" />
          </AnimatedG>
          <Path d="M40 60 Q48 66 56 60" stroke="#2E1F7A" strokeWidth={2.5} strokeLinecap="round" />
          <Path d="M84 52 Q94 44 90 34 Q96 46 86 56 Z" fill="#FCD34D" />
        </Svg>
      </Animated.View>
    </View>
  );
}
