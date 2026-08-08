import { useEffect, useRef, useState } from 'react';
import { Text, Animated } from 'react-native';

interface XpCounterTickProps {
  targetXp: number;
  trigger: boolean;
  style?: object;
}

export function XpCounterTick({ targetXp, trigger, style }: XpCounterTickProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (trigger && targetXp > 0) {
      animatedValue.setValue(0);
      setDisplayValue(0);

      // Counter tick
      Animated.timing(animatedValue, { toValue: targetXp, duration: 1000, useNativeDriver: false }).start();

      // Scale bounce
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.2, speed: 20, bounciness: 8, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, speed: 15, bounciness: 6, useNativeDriver: true }),
      ]).start();

      // Listen to value changes
      const listenerId = animatedValue.addListener(({ value }) => {
        setDisplayValue(Math.round(value));
      });

      return () => {
        animatedValue.removeListener(listenerId);
      };
    }
  }, [trigger, targetXp, animatedValue, scale]);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Text style={{ color: '#38BDF8', fontSize: 32, fontWeight: '800', textAlign: 'center' }}>
        +{displayValue} XP
      </Text>
    </Animated.View>
  );
}
