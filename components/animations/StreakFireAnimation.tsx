import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StreakFireAnimationProps {
  streak: number;
  visible: boolean;
}

export function StreakFireAnimation({ streak, visible }: StreakFireAnimationProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const isMilestone = streak === 7 || streak === 30 || streak === 100 || streak === 365;
  const flameSize = streak >= 100 ? 48 : streak >= 30 ? 40 : 32;

  useEffect(() => {
    if (visible && isMilestone) {
      Animated.spring(scale, { toValue: 1, speed: 10, bounciness: 10, useNativeDriver: true }).start();

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.6, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.2, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulseRef.current = pulse;
      pulse.start();
    } else {
      pulseRef.current?.stop();
      Animated.timing(scale, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      Animated.timing(glowOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }

    return () => {
      pulseRef.current?.stop();
    };
  }, [visible, isMilestone, scale, glowOpacity]);

  if (!visible || !isMilestone) return null;

  return (
    <Animated.View style={{ alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: flameSize + 20,
          height: flameSize + 20,
          borderRadius: (flameSize + 20) / 2,
          backgroundColor: '#F59E0B',
          opacity: glowOpacity,
        }}
      />
      <Ionicons name="flame" size={flameSize} color="#F59E0B" />
    </Animated.View>
  );
}
