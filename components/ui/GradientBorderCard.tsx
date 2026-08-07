/**
 * GradientBorderCard — 1.5px indigo→lilac gradient rule around an opaque card.
 *
 * Used by SectionBanner and LevelBadge. The gradient BORDER is the whole point
 * of the component and stays; the glass inner fill and specular sheen are gone,
 * replaced with surface.card so it matches every other card under the Dark Glow
 * theme. Border runs primary → premium (indigo.600 → #E0BE6B), the deck's
 * `linear-gradient(135deg, primary, lilac)`.
 */

import { View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_GRADIENT_COLORS } from '../../config/gradients';
import { colors } from '../../config/theme';

interface GradientBorderCardProps {
  children: React.ReactNode;
  borderWidth?: number;
  borderRadius?: number;
  innerBg?: string;
  style?: ViewStyle;
  innerStyle?: ViewStyle;
}

export function GradientBorderCard({
  children,
  borderWidth = 1.5,
  borderRadius = 18,
  innerBg = colors.surface.card,
  style,
  innerStyle,
}: GradientBorderCardProps) {
  const innerRadius = borderRadius - borderWidth;

  return (
    <LinearGradient
      colors={[...BORDER_GRADIENT_COLORS]}
      // 135deg — diagonal, matching the deck. The old horizontal sweep made the
      // rule read as a flat two-tone band on wide cards.
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius, padding: borderWidth }, style]}
    >
      <View
        style={[
          {
            flex: 1,
            backgroundColor: innerBg,
            borderRadius: innerRadius,
            borderWidth: 1,
            borderColor: colors.border.default,
            overflow: 'hidden',
          },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}
