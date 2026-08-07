import { Pressable, View, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { useMotion } from '../../hooks/useMotion';
import type { PathNodeState } from '../../lib/learning-path';

interface PathNodeProps {
  state: PathNodeState;
  icon: string;
  score: number | null;
  onPress: () => void;
  isActive: boolean;
}

const STATE_COLORS: Record<PathNodeState, string> = {
  active: '#86B4CE',
  completed: '#4E9F6B',
  locked: '#24221E',
};

export function PathNode({ state, icon, score, onPress, isActive }: PathNodeProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const { shouldReduce } = useMotion();

  useEffect(() => {
    // The active node pulses indefinitely, which is exactly the shape WCAG 2.2
    // SC 2.2.2 governs: auto-starting, longer than five seconds, alongside
    // other content. Reduce Motion (OS switch or the in-app toggle) stops it
    // and leaves the node at rest — the node is still identifiable by colour
    // and position, so nothing is lost by holding still.
    if (isActive && !shouldReduce) {
      const loop = Animated.loop(
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
      );
      loop.start();
      return () => {
        loop.stop();
        scale.setValue(1);
      };
    }
    scale.setValue(1);
  }, [isActive, shouldReduce, scale]);

  const isLocked = state === 'locked';
  const isCompleted = state === 'completed';
  const displayIcon = isLocked ? 'lock-closed' : isCompleted ? 'checkmark' : icon;
  const iconColor = isLocked ? '#7A756B' : '#FFFFFF';
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
              backgroundColor: '#D9913C',
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
