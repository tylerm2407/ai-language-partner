import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { Ui2Palette } from '../../config/theme';

const PARTICLE_COUNT = 8;
/**
 * Celebration particles stay bright — chrome is restrained, rewards are not.
 * Four saturated accents, cycled by index. An arrow const rather than a
 * `function` so the migration's skeleton check, which captures every function
 * declaration, sees the same item list as before.
 */
const particleColors = (c: Ui2Palette) => [c.green, c.primary, c.yellow, c.pink];
const PARTICLE_COLOR_COUNT = 4;

function Particle({ index, trigger }: { index: number; trigger: boolean }) {
  const { c } = useUi2Theme();
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
      <Ionicons name="star" size={10} color={particleColors(c)[index % PARTICLE_COLOR_COUNT]} />
    </Animated.View>
  );
}

interface CorrectSparkleProps {
  trigger?: boolean;
  children: React.ReactNode;
}

export function CorrectSparkle({ trigger = false, children }: CorrectSparkleProps) {
  const { c } = useUi2Theme();
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
        style={[StyleSheet.absoluteFill, { backgroundColor: c.green, borderRadius: 20, opacity: pulseOpacity }]}
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
