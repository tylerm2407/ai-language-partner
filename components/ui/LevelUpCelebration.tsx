import { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import type { CEFRLevel } from '../../types';

const CEFR_LABELS: Record<CEFRLevel, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper Intermediate',
  C1: 'Advanced',
  C2: 'Mastery',
};

interface LevelUpCelebrationProps {
  newLevel: CEFRLevel;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function LevelUpCelebration({
  newLevel,
  onDismiss,
  autoDismissMs = 4000,
}: LevelUpCelebrationProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const badgeScale = useSharedValue(0);

  useEffect(() => {
    // Entrance animation
    opacity.value = withTiming(1, { duration: 300 });
    scale.value = withSequence(
      withTiming(1.1, { duration: 400, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 200 })
    );
    badgeScale.value = withDelay(
      300,
      withSequence(
        withTiming(1.2, { duration: 300, easing: Easing.out(Easing.back(3)) }),
        withTiming(1, { duration: 200 })
      )
    );

    // Auto-dismiss
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        },
        overlayStyle,
      ]}
    >
      <Pressable onPress={onDismiss} style={{ alignItems: 'center' }} accessibilityRole="button">
        <Animated.View style={[{ alignItems: 'center' }, contentStyle]}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 }}>
            Level Up!
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            {
              backgroundColor: '#6366F1',
              paddingHorizontal: 32,
              paddingVertical: 16,
              borderRadius: 20,
              alignItems: 'center',
              marginTop: 8,
            },
            badgeStyle,
          ]}
        >
          <Text style={{ fontSize: 36, fontWeight: '800', color: '#fff' }}>{newLevel}</Text>
          <Text style={{ fontSize: 15, color: '#C7D2FE', marginTop: 4 }}>
            {CEFR_LABELS[newLevel]}
          </Text>
        </Animated.View>

        <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 24 }}>Tap to dismiss</Text>
      </Pressable>
    </Animated.View>
  );
}
