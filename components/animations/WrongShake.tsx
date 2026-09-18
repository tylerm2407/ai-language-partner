import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { useMotion } from '../../hooks/useMotion';

interface WrongShakeProps {
  trigger?: boolean;
  children: React.ReactNode;
}

/**
 * The wrong-answer response: a six-step horizontal shake plus a red tint.
 *
 * Reduced motion drops the shake and keeps the tint. The two halves carry the
 * same message by different means, and only one of them is movement — a rapid
 * side-to-side translation of the whole exercise is close to the worst case for
 * vestibular sensitivity, while a colour fade tells the learner they got it
 * wrong without moving anything. Losing the feedback entirely would be the
 * wrong reading of the setting; losing the motion is the whole point of it.
 */
export function WrongShake({ trigger = false, children }: WrongShakeProps) {
  const { c } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const translateX = useRef(new Animated.Value(0)).current;
  const tintOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!trigger) return;

    const tint = Animated.sequence([
      Animated.timing(tintOpacity, { toValue: 0.15, duration: 100, useNativeDriver: true }),
      Animated.timing(tintOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]);

    if (shouldReduce) {
      translateX.setValue(0);
      tint.start();
      return;
    }

    Animated.parallel([
      Animated.sequence([
        Animated.timing(translateX, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -5, duration: 60, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
      tint,
    ]).start();
  }, [trigger, shouldReduce, translateX, tintOpacity]);

  return (
    <Animated.View style={{ transform: [{ translateX }] }}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: c.error, borderRadius: 20, opacity: tintOpacity }]}
        pointerEvents="none"
      />
      {children}
    </Animated.View>
  );
}
