import { useRef } from 'react';
import { Pressable, Text, ActivityIndicator, Animated, type TextStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic } from '../../lib/haptics';
import { GRADIENT_START, GRADIENT_END } from '../../config/gradients';
import { ui2Shape, ui2Type, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';

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

interface VariantStyle {
  container: ViewStyle;
  text: TextStyle;
  disabledContainer: ViewStyle;
}

/** Shared box for the three filled variants — layout only, no colour. */
const BOX: ViewStyle = {
  paddingVertical: 16,
  paddingHorizontal: 48,
  borderRadius: 14,
  alignItems: 'center',
};

const LABEL: TextStyle = { fontSize: 18, fontFamily: ui2Type.uiBold };

/**
 * The variant table, resolved against the scheme-aware palette. These were
 * tailwind classes (`bg-dark-card-alt`, `text-text-primary`), which is the
 * fixed dark palette by another name — `tailwind.config.js` mirrors the Dark
 * Glow tokens and has no light scheme at all.
 *
 * There is no shadow anywhere in this file any more. UI 2.0 spends its depth on
 * the slab bottom edge, not on elevation — `components/ui2` contains zero
 * `shadowColor`/`elevation` declarations — and the violet glow that used to sit
 * under the primary CTA was a dark-mode device: on a white ground a coloured
 * shadow reads as a smudge. Adding a real slab edge here would change the
 * button's height, which is a shape decision rather than a palette one.
 *
 * `danger` is the one variant the UI 2.0 palette cannot render as red-on-red
 * and still clear AA: `error` on `pinkTint` is 3.4:1 in light. It follows the
 * answer `Ui2Badge` already documented — the tint and the 2px border carry the
 * hue, the label stays `ink` (13.6:1 light, 13.1:1 dark). The variant has no
 * call sites today.
 */
const variantStyles = (c: Ui2Palette): Record<ButtonVariant, VariantStyle> => ({
  primary: {
    container: { ...BOX, backgroundColor: c.primary },
    text: { ...LABEL, color: c.onPrimary },
    // Dimmed, not recoloured. A disabled state that swaps in a BRIGHTER fill
    // reads as the more prominent one — which is what the old `primary-light`
    // did, at 2.87:1 under white. The gradient path below dims the same way.
    disabledContainer: { ...BOX, backgroundColor: c.primary, opacity: 0.6 },
  },
  secondary: {
    container: { ...BOX, backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: ui2Shape.border },
    text: { ...LABEL, color: c.ink },
    disabledContainer: { ...BOX, backgroundColor: c.card, borderColor: c.cardBorder, borderWidth: ui2Shape.border, opacity: 0.5 },
  },
  danger: {
    container: { ...BOX, backgroundColor: c.pinkTint, borderColor: c.error, borderWidth: ui2Shape.border },
    text: { ...LABEL, color: c.ink },
    disabledContainer: { ...BOX, backgroundColor: c.pinkTint, borderColor: c.error, borderWidth: ui2Shape.border, opacity: 0.5 },
  },
  text: {
    container: { alignItems: 'center' },
    text: { fontSize: 16, fontFamily: ui2Type.ui, color: c.onTint },
    disabledContainer: { alignItems: 'center', opacity: 0.5 },
  },
});

export function Button({ label, variant = 'primary', onPress, disabled, loading, style, accessibilityHint }: ButtonProps) {
  const { c } = useUi2Theme();
  const config = variantStyles(c)[variant];
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

  if (variant === 'primary') {
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
              <Text style={config.text}>{label}</Text>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        style={disabled || loading ? config.disabledContainer : config.container}
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
          <ActivityIndicator color={c.primary} />
        ) : (
          <Text style={config.text}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
