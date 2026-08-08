import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ChallengeCompletePopProps {
  trigger: boolean;
}

export function ChallengeCompletePop({ trigger }: ChallengeCompletePopProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
