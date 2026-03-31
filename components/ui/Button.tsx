import { useRef } from 'react';
import { Pressable, Text, ActivityIndicator, Animated, type ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text';

interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

const variantClasses: Record<ButtonVariant, { container: string; text: string; disabledContainer: string }> = {
  primary: {
    container: 'bg-primary py-4 px-12 rounded-[14px] items-center',
    text: 'text-white text-lg font-sans-semibold',
    disabledContainer: 'bg-primary-light py-4 px-12 rounded-[14px] items-center',
  },
  secondary: {
    container: 'bg-dark-card-alt py-4 px-12 rounded-[14px] items-center',
    text: 'text-text-primary text-lg font-sans-semibold',
    disabledContainer: 'bg-dark-card-alt py-4 px-12 rounded-[14px] items-center opacity-50',
  },
  danger: {
    container: 'bg-error-bg py-4 px-12 rounded-[14px] items-center',
    text: 'text-error-dark text-lg font-sans-semibold',
    disabledContainer: 'bg-error-bg py-4 px-12 rounded-[14px] items-center opacity-50',
  },
  text: {
    container: 'items-center',
    text: 'text-primary text-base',
    disabledContainer: 'items-center opacity-50',
  },
};

export function Button({ label, variant = 'primary', onPress, disabled, loading, style, accessibilityHint }: ButtonProps) {
  const config = variantClasses[variant];
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

  const glowStyle = variant === 'primary' ? {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  } : {};

  if (variant === 'primary') {
    return (
      <Animated.View style={[{ transform: [{ scale }] }, style, glowStyle]}>
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
            }}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className={config.text}>{label}</Text>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        className={disabled || loading ? config.disabledContainer : config.container}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || loading }}
      >
        {loading ? (
          <ActivityIndicator color={'#38BDF8'} />
        ) : (
          <Text className={config.text}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
