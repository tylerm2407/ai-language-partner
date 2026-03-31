import { useRef } from 'react';
import { Pressable, Text, ActivityIndicator, Animated, type ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

export function GradientButton({ label, onPress, disabled, loading, style, accessibilityHint }: GradientButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    onPress();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || loading }}
      >
        <LinearGradient
          colors={[...GRADIENT_COLORS]}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={{
            paddingVertical: 16,
            paddingHorizontal: 48,
            borderRadius: 14,
            alignItems: 'center' as const,
            opacity: disabled || loading ? 0.6 : 1,
            shadowColor: '#7878FA',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
