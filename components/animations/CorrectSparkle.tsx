import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PARTICLE_COUNT = 8;
const COLORS = ['#34D399', '#38BDF8', '#FBBF24', '#A855F7'];

function Particle({ index, trigger }: { index: number; trigger: boolean }) {
  const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
  const distance = 40 + (index % 3) * 10;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger) {
      translateX.setValue(0);
      translateY.setValue(0);
      opacity.setValue(0);
      scale.setValue(0);

      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance;

      Animated.sequence([
        Animated.delay(index * 30),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.delay(300),
            Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
          Animated.spring(scale, { toValue: 1, speed: 30, bounciness: 10, useNativeDriver: true }),
          Animated.spring(translateX, { toValue: targetX, speed: 12, bounciness: 6, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: targetY, speed: 12, bounciness: 6, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [trigger, angle, distance, index, translateX, translateY, opacity, scale]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        transform: [{ translateX }, { translateY }, { scale }],
        opacity,
      }}
    >
      <Ionicons name="star" size={10} color={COLORS[index % COLORS.length]} />
    </Animated.View>
  );
}

interface CorrectSparkleProps {
  trigger?: boolean;
  children: React.ReactNode;
}

export function CorrectSparkle({ trigger = false, children }: CorrectSparkleProps) {
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger) {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.05, duration: 150, useNativeDriver: true }),
          Animated.spring(pulseScale, { toValue: 1, speed: 15, bounciness: 8, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0.3, duration: 150, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [trigger, pulseScale, pulseOpacity]);

  return (
    <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#34D399', borderRadius: 20, opacity: pulseOpacity }]}
        pointerEvents="none"
      />
      {children}
      {trigger && (
        <View style={{ position: 'absolute', top: '50%', left: '50%' }} pointerEvents="none">
          {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
            <Particle key={i} index={i} trigger={trigger} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}
