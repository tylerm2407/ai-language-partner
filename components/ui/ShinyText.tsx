import React, { useEffect } from 'react';
import { View, Text, type TextStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface ShinyTextProps {
  text: string;
  speed?: number;
  delay?: number;
  color?: string;
  shineColor?: string;
  disabled?: boolean;
  style?: TextStyle;
  containerStyle?: ViewStyle;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export function ShinyText({
  text,
  speed = 2,
  delay = 0,
  color = '#b5b5b5',
  shineColor = '#ffffff',
  disabled = false,
  style,
  containerStyle,
}: ShinyTextProps) {
  const translateX = useSharedValue(-1);

  useEffect(() => {
    if (disabled) return;
    translateX.value = withDelay(
      delay * 1000,
      withRepeat(
        withTiming(1, { duration: speed * 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        false
      )
    );
  }, [speed, delay, disabled, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * 300 }],
  }));

  return (
    <View style={[{ overflow: 'hidden', position: 'relative' }, containerStyle]}>
      {/* Base text in the muted color */}
      <Text style={[{ color }, style]}>{text}</Text>

      {/* Animated shine overlay — clipped to container */}
      <AnimatedLinearGradient
        colors={['transparent', shineColor, 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 80,
            opacity: 0.25,
          },
          animatedStyle,
        ]}
        pointerEvents="none"
      />
    </View>
  );
}
