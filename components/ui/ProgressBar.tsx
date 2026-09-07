import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_START, GRADIENT_END } from '../../config/gradients';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { Ui2Palette } from '../../config/theme';

interface ProgressBarProps {
  progress: number; // 0 to 1
  height?: number;
}

/**
 * The groove. `track` is the palette's unfilled-progress token — the same pair
 * (`track` behind, `primary` in front) that `Ui2ProgressBar` and `StepHeader`
 * use, so a screen showing both bars shows one bar.
 *
 * The `#818CF8` glow shadow that used to sit here is gone: it was tuned for a
 * near-black ground and on a white one it is either invisible or a smudge.
 */
const trackStyle = (c: Ui2Palette, height: number) => ({
  backgroundColor: c.track,
  height,
  borderRadius: 999,
  overflow: 'hidden' as const,
  width: '100%' as const,
});

export function ProgressBar({ progress, height = 8 }: ProgressBarProps) {
  const { c } = useUi2Theme();
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const widthAnim = useRef(new Animated.Value(clampedProgress)).current;

  useEffect(() => {
    Animated.spring(widthAnim, { toValue: clampedProgress, useNativeDriver: false, speed: 12, bounciness: 4 }).start();
  }, [clampedProgress, widthAnim]);

  return (
    <View
      style={trackStyle(c, height)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clampedProgress * 100) }}
    >
      <Animated.View
        style={{
          borderRadius: 999,
          height,
          width: widthAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        }}
      >
        <LinearGradient
          colors={[c.primary, c.slab]}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={{ flex: 1, borderRadius: 999 }}
        />
      </Animated.View>
    </View>
  );
}
