/** Chip — small tinted pill for CEFR bands, minutes, suggestion tags. */
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface ChipProps {
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Chip({ label, onPress, style }: ChipProps) {
  const { c, type, shape } = useUi2Theme();
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
          backgroundColor: c.primaryTint,
          borderColor: c.primaryTintBorder,
          borderWidth: shape.border,
          // Tappable chips meet the 44pt target through their hit slop.
        },
        style,
      ]}
      hitSlop={onPress ? { top: 8, bottom: 8, left: 4, right: 4 } : undefined}
    >
      <Text style={{ fontFamily: type.uiHeavy, fontSize: 12, color: c.onTint }}>{label}</Text>
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
