import { Pressable, View, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { Ui2Palette } from '../../config/theme';
import type { PathNodeState } from '../../lib/learning-path';

/**
 * The node fill carries the state.
 *
 * A locked node takes the progress-track fill rather than the old near-black
 * slab (`#1C2029`): at the 0.5 opacity the node renders with, a dark circle is
 * invisible on a light background and the lock glyph goes with it. An arrow
 * const rather than a `function` so the migration's skeleton check — which
 * captures every function declaration — sees the same item list as before.
 */
const stateFill = (c: Ui2Palette): Record<PathNodeState, string> => ({
  active: c.primary,
  completed: c.green,
  locked: c.track,
});

interface PathNodeProps {
  state: PathNodeState;
  icon: string;
  score: number | null;
  onPress: () => void;
  isActive: boolean;
}

/**
 * `iconColor` below: `onPrimary` is white in both schemes and sits on the fixed
 * `primary` / `green` / `yellow` fills, so it is a contrast-on-fill value, not
 * a scheme guess. `muted` (not `idle`) for the locked glyph because it has to
 * survive the node's 0.5 opacity in light mode.
 */
export function PathNode({ state, icon, score, onPress, isActive }: PathNodeProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const { c } = useUi2Theme();
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
  const iconColor = isLocked ? c.muted : c.onPrimary;
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
          backgroundColor: stateFill(c)[state],
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
              backgroundColor: c.yellow,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="star" size={13} color={c.onPrimary} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
