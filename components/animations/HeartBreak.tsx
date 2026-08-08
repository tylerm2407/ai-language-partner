import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HeartBreakProps {
  trigger: boolean;
}

export function HeartBreak({ trigger }: HeartBreakProps) {
  const leftX = useRef(new Animated.Value(0)).current;
  const rightX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger) {
      leftX.setValue(0);
      rightX.setValue(0);
      opacity.setValue(0);
      scale.setValue(0);

      // Pop in
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 8, useNativeDriver: true }),
      ]).start();

      // Split and fade after delay
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(leftX, { toValue: -30, duration: 500, useNativeDriver: true }),
          Animated.timing(rightX, { toValue: 30, duration: 500, useNativeDriver: true }),
        ]),
      ]).start();

      Animated.sequence([
        Animated.delay(600),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [trigger, leftX, rightX, opacity, scale]);

  if (!trigger) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: '40%',
        alignSelf: 'center',
        zIndex: 999,
        flexDirection: 'row',
        opacity,
        transform: [{ scale }],
      }}
      pointerEvents="none"
    >
      <Animated.View style={{ transform: [{ translateX: leftX }] }}>
        <Ionicons name="heart-half" size={40} color="#EF4444" style={{ transform: [{ scaleX: -1 }] }} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: rightX }] }}>
        <Ionicons name="heart-half" size={40} color="#EF4444" />
      </Animated.View>
    </Animated.View>
  );
}
