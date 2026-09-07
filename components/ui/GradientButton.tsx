import { useRef } from 'react';
import { Pressable, Text, ActivityIndicator, Animated, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic } from '../../lib/haptics';
import { GRADIENT_START, GRADIENT_END } from '../../config/gradients';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

/**
 * The gradient is the component, so it stays — but the stops are now
 * `primary → slab` from the scheme-aware palette instead of the Dark Glow
 * lilac→sky pair, and the violet glow shadow is gone. That glow was tuned for a
 * near-black ground; on white it is either invisible or a smudge.
 */
export function GradientButton({ label, onPress, disabled, loading, style, accessibilityHint }: GradientButtonProps) {
  const { c, type } = useUi2Theme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const handlePress = () => {
    haptic('select');
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
          colors={[c.primary, c.slab]}
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
            <ActivityIndicator color={c.onPrimary} />
          ) : (
            <Text style={{ color: c.onPrimary, fontSize: 18, fontFamily: type.ui }}>{label}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
