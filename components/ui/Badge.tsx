import { View, Text, type TextStyle, type ViewStyle } from 'react-native';
import { ui2Type, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { badgeColors } from '../ui2/Ui2Badge';

type BadgeVariant = 'primary' | 'success' | 'warning';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

/**
 * The variant table is `badgeColors` from `components/ui2/Ui2Badge.tsx` rather
 * than a second copy of it. The two badges share a variant vocabulary and
 * DESIGN.md maps this one onto that one, so a duplicated table would only be a
 * place for them to drift apart — and that file documents why the success and
 * warning labels are `ink` rather than their own hue (green on greenTint is
 * near 2:1, well under AA at this size).
 */
const badgeStyles = (
  c: Ui2Palette,
  variant: BadgeVariant,
): { container: ViewStyle; text: TextStyle } => {
  const { bg, border, text } = badgeColors(c, variant);
  return {
    container: {
      backgroundColor: bg,
      borderColor: border,
      borderWidth: 2,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    text: { color: text, fontSize: 12, fontFamily: ui2Type.uiBold },
  };
};

export function Badge({ label, variant = 'primary' }: BadgeProps) {
  const { c } = useUi2Theme();
  const config = badgeStyles(c, variant);
  return (
    <View style={config.container}>
      <Text style={config.text}>{label}</Text>
    </View>
  );
}
