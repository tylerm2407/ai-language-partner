import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';
import { Ionicons } from '@expo/vector-icons';
import type { AchievementDefinition } from '../../lib/achievements';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PARTICLE_COUNT = 12;

// ─── Confetti Particle ──────────────────────────────────────────

function ConfettiParticle({ index, color }: { index: number; color: string }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
    const distance = 80 + Math.random() * 60;
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    const delay = index * 40;

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.delay(600),
          Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.spring(scale, { toValue: 1, speed: 30, bounciness: 10, useNativeDriver: true }),
          Animated.delay(400),
          Animated.timing(scale, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        Animated.spring(translateX, { toValue: targetX, speed: 10, bounciness: 6, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: targetY, speed: 10, bounciness: 6, useNativeDriver: true }),
        Animated.timing(rotation, {
          toValue: Math.random() > 0.5 ? 1 : -1,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [index, translateX, translateY, opacity, scale, rotation]);

  const shapes = ['ellipse', 'star-outline', 'diamond-outline'] as const;
  const shape = shapes[index % shapes.length];
  const size = 8 + (index % 3) * 4;

  const spin = rotation.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        transform: [{ translateX }, { translateY }, { scale }, { rotate: spin }],
        opacity,
      }}
    >
      <Ionicons name={shape} size={size} color={color} />
    </Animated.View>
  );
}

// ─── Achievement Modal ──────────────────────────────────────────

export function AchievementModal({ achievement, visible, onDismiss }: {
  achievement: AchievementDefinition | null;
  visible: boolean;
  onDismiss: () => void;
}) {
  const cardScale = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && achievement) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, speed: 14, bounciness: 8, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(iconScale, { toValue: 1, speed: 30, bounciness: 10, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, achievement, backdropOpacity, cardScale, cardOpacity, iconScale]);

  if (!achievement) return null;

  const confettiColors = [achievement.color, '#FBBF24', '#34D399', '#38BDF8', '#F472B6', '#60A5FA'];

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <Animated.View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          opacity: backdropOpacity,
        }}
      >
        <Animated.View
          style={{
            width: SCREEN_WIDTH * 0.82,
            borderRadius: 24,
            overflow: 'hidden',
            transform: [{ scale: cardScale }],
            opacity: cardOpacity,
          }}
        >
        <LinearGradient
          colors={[...GRADIENT_COLORS]}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={{ borderRadius: 24, padding: 1.5 }}
        >
        <View style={{
          borderRadius: 22.5,
          padding: 32,
          alignItems: 'center',
          backgroundColor: '#151921',
        }}>
          {/* Confetti Particles */}
          <View style={{ position: 'absolute', top: '40%', left: '50%' }}>
            {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
              <ConfettiParticle
                key={i}
                index={i}
                color={confettiColors[i % confettiColors.length]}
              />
            ))}
          </View>

          {/* Achievement Unlocked Label */}
          <Text className="text-sm font-semibold text-text-secondary tracking-widest uppercase mb-4">
            Achievement Unlocked
          </Text>

          {/* Icon */}
          <Animated.View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: achievement.color + '20',
              marginBottom: 16,
              transform: [{ scale: iconScale }],
            }}
          >
            <Ionicons
              name={achievement.icon as any}
              size={40}
              color={achievement.color}
            />
          </Animated.View>

          {/* Title */}
          <Text className="text-2xl font-bold text-text-primary text-center mb-2">
            {achievement.title}
          </Text>

          {/* Description */}
          <Text className="text-base text-text-secondary text-center mb-8">
            {achievement.description}
          </Text>

          {/* Dismiss Button */}
          <Pressable
            className="w-full rounded-2xl py-4 items-center"
            style={{ backgroundColor: achievement.color }}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss achievement"
          >
            <Text className="text-white text-lg font-bold">Awesome!</Text>
          </Pressable>
        </View>
        </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
