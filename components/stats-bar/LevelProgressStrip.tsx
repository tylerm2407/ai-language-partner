import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';

interface LevelProgressStripProps {
  progress: number;
}

const BG_COLOR = 'rgba(100, 116, 139, 0.2)';

function LevelProgressStripInner({ progress }: LevelProgressStripProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const widthAnim = useRef(new Animated.Value(clampedProgress)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: clampedProgress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [clampedProgress, widthAnim]);

  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={styles.container}
      accessibilityLabel={`Level progress ${Math.round(clampedProgress * 100)}%`}
      accessibilityRole="progressbar"
    >
      <Animated.View style={[styles.fill, { width: animatedWidth }]}>
        <LinearGradient
          colors={[GRADIENT_COLORS[0], GRADIENT_COLORS[1]]}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 2,
    width: '100%',
    backgroundColor: BG_COLOR,
  },
  fill: {
    height: 2,
    overflow: 'hidden',
  },
});

export const LevelProgressStrip = React.memo(LevelProgressStripInner);
