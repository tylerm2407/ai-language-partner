import { Pressable, View, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import type { PathNodeState } from '../../lib/learning-path';

interface PathNodeProps {
  state: PathNodeState;
  icon: string;
  score: number | null;
  onPress: () => void;
  isActive: boolean;
}

const STATE_COLORS: Record<PathNodeState, string> = {
  active: '#38BDF8',
  completed: '#34D399',
  locked: '#1C2029',
};

export function PathNode({ state, icon, score, onPress, isActive }: PathNodeProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.08,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scale.setValue(1);
    }
  }, [isActive, scale]);

  const isLocked = state === 'locked';
  const isCompleted = state === 'completed';
  const displayIcon = isLocked ? 'lock-closed' : isCompleted ? 'checkmark' : icon;
  const iconColor = isLocked ? '#64748B' : '#FFFFFF';
  const hasStarBadge = isCompleted && score !== null && score >= 0.9;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={isLocked}
        accessibilityRole="button"
        accessibilityLabel={isLocked ? 'Locked lesson' : `Lesson ${icon}`}
        accessibilityState={{ disabled: isLocked }}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: STATE_COLORS[state],
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isLocked ? 0.5 : 1,
        }}
      >
        <Ionicons
          name={displayIcon as keyof typeof Ionicons.glyphMap}
          size={28}
          color={iconColor}
        />
        {hasStarBadge && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: '#FBBF24',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="star" size={13} color="#FFFFFF" />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
