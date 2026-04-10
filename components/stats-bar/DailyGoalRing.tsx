import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DailyGoalRingProps {
  progress: number;
}

const SIZE = 28;
const STROKE_WIDTH = 3;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const BG_COLOR = 'rgba(100, 116, 139, 0.2)';
const PROGRESS_COLOR = '#38BDF8';

function DailyGoalRingInner({ progress }: DailyGoalRingProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const animatedProgress = useRef(new Animated.Value(clampedProgress)).current;
  const isComplete = clampedProgress >= 1;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: clampedProgress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [clampedProgress, animatedProgress]);

  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  return (
    <View
      style={styles.container}
      accessibilityLabel={
        isComplete
          ? 'Daily goal complete'
          : `Daily goal ${Math.round(clampedProgress * 100)}% complete`
      }
      accessibilityRole="progressbar"
    >
      <Svg width={SIZE} height={SIZE} style={styles.svg}>
        {/* Background circle */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={BG_COLOR}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Progress circle */}
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={PROGRESS_COLOR}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      {isComplete && (
        <View style={styles.checkmark}>
          <Ionicons name="checkmark-circle" size={12} color={PROGRESS_COLOR} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    transform: [{ rotateZ: '0deg' }],
  },
  checkmark: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
});

export const DailyGoalRing = React.memo(DailyGoalRingInner);
