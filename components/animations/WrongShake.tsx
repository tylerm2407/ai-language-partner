import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

interface WrongShakeProps {
  trigger?: boolean;
  children: React.ReactNode;
}

export function WrongShake({ trigger = false, children }: WrongShakeProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const tintOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger) {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(translateX, { toValue: -10, duration: 60, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 10, duration: 60, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: -10, duration: 60, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 10, duration: 60, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: -5, duration: 60, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(tintOpacity, { toValue: 0.15, duration: 100, useNativeDriver: true }),
          Animated.timing(tintOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [trigger, translateX, tintOpacity]);

  return (
    <Animated.View style={{ transform: [{ translateX }] }}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#EF4444', borderRadius: 20, opacity: tintOpacity }]}
        pointerEvents="none"
      />
      {children}
    </Animated.View>
  );
}
