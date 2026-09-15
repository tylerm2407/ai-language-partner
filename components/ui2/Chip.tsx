/** Chip — small tinted pill for CEFR bands, minutes, suggestion tags. */
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useUi2Theme } from '../../hooks/useUi2Theme';

/**
 * Mirrors the Dark Glow `components/ui/Chip` vocabulary so migrating screens
 * port unchanged. `primary` is the default look this chip already had, so
 * existing UI 2.0 call sites that pass no variant are unaffected.
 */
export type ChipVariant = 'neutral' | 'primary' | 'success' | 'error' | 'warning' | 'premium';

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  leftIcon?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Chip({ label, variant = 'primary', leftIcon, onPress, style }: ChipProps) {
  const { c, type, shape } = useUi2Theme();
  // Every variant resolves through the scheme-aware palette, so a chip is
  // legible in both schemes. `premium` deliberately shares the primary tint —
  // UI 2.0 has one accent, and inventing a second here would put a colour on
  // screen that exists nowhere in the design.
  const fill =
    variant === 'success' ? { bg: c.greenTint, border: c.greenBorder, fg: c.green }
      : variant === 'error' ? { bg: c.pinkTint, border: c.pinkTint, fg: c.error }
      : variant === 'warning' ? { bg: c.yellowTint, border: c.yellowBorder, fg: c.yellow }
      : variant === 'neutral' ? { bg: c.surface2, border: c.cardBorder, fg: c.muted }
      : { bg: c.primaryTint, border: c.primaryTintBorder, fg: c.onTint };
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              haptic('select');
              onPress();
            }
          : undefined
      }
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      style={[
        styles.chip,
        {
          backgroundColor: fill.bg,
          borderColor: fill.border,
          borderWidth: shape.border,
          // Tappable chips meet the 44pt target through their hit slop.
        },
        style,
      ]}
      hitSlop={onPress ? { top: 8, bottom: 8, left: 4, right: 4 } : undefined}
    >
      {leftIcon}
      <Text style={{ fontFamily: type.uiHeavy, fontSize: 12, color: fill.fg }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
