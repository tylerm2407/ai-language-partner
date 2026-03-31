import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';

interface ProgressBarProps {
  progress: number; // 0 to 1
  height?: number;
}

export function ProgressBar({ progress, height = 8 }: ProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const widthAnim = useRef(new Animated.Value(clampedProgress)).current;

  useEffect(() => {
    Animated.spring(widthAnim, { toValue: clampedProgress, useNativeDriver: false, speed: 12, bounciness: 4 }).start();
  }, [clampedProgress, widthAnim]);

  return (
    <View
      className="bg-dark-card-alt rounded-full overflow-hidden w-full"
      style={[
        { height },
        clampedProgress > 0 ? {
          shadowColor: '#38BDF8',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 3,
        } : {},
      ]}
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
          colors={[...GRADIENT_COLORS]}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={{ flex: 1, borderRadius: 999 }}
        />
      </Animated.View>
    </View>
  );
}
