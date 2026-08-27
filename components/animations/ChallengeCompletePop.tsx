import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';

interface ChallengeCompletePopProps {
  /**
   * True while the challenge is complete.
   *
   * For the haptic to fire this has to be a real state *transition* — false
   * while the challenge is outstanding, flipping to true at the moment it is
   * finished. A caller that hardcodes `trigger={true}` and mounts the component
   * only when already complete gets the animation but no vibration, on purpose:
   * see the guard in the effect below.
   */
  trigger: boolean;
}

export function ChallengeCompletePop({ trigger }: ChallengeCompletePopProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  /**
   * Whether this component has ever rendered with `trigger` already true.
   *
   * The animation is happy to replay on mount — a checkmark popping in as the
   * screen appears is decoration, and costs nothing if it happens twice. A
   * vibration is not decoration. Opening the home screen with three challenges
   * already ticked off must not buzz three times, and this list re-mounts its
   * rows on navigation, so mount-with-true is far more often "was already done
   * yesterday" than "just finished".
   *
   * Seeding the ref from the first observed value is what separates the two:
   * true on the first render means already-complete (stay silent), while
   * false→true later means it happened in front of the learner (buzz).
   */
  const wasComplete = useRef<boolean | null>(null);

  useEffect(() => {
    const firstObservation = wasComplete.current === null;
    const justCompleted = !firstObservation && !wasComplete.current && trigger;
    wasComplete.current = trigger;

    if (justCompleted) haptic('challengeComplete');

    if (trigger) {
      scale.setValue(0);
      opacity.setValue(0);

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.sequence([
          Animated.spring(scale, { toValue: 1.3, speed: 20, bounciness: 10, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, speed: 15, bounciness: 6, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [trigger, scale, opacity]);

  if (!trigger) return null;

  return (
    <Animated.View style={{ alignItems: 'center', justifyContent: 'center', transform: [{ scale }], opacity }}>
      <Ionicons name="checkmark-circle" size={28} color="#34D399" />
    </Animated.View>
  );
}
