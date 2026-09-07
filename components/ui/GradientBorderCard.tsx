/**
 * GradientBorderCard — a gradient rule around an opaque card.
 *
 * Used by SectionBanner and LevelBadge. The gradient BORDER is the whole point
 * of the component, so it stays; what changed is where its two stops come from.
 * They used to be fixed indigo→lilac hexes, which is a dark-ground gradient and
 * washes out on white. They are now `primary → slab` from `useUi2Theme()`: the
 * accent and its pressed/shadow step, which is the only ramp UI 2.0 actually
 * defines, and which reads in both schemes.
 *
 * Worth saying plainly: UI 2.0 has no gradient vocabulary. DESIGN.md's
 * migration table maps this component to `SlabCard`, and that — not a retinted
 * gradient — is the real destination. Doing it here would change how
 * SectionBanner and LevelBadge look, which is a call for whoever owns those two
 * files, so this keeps the component's shape and only fixes the palette.
 */

import { View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useUi2Theme } from '../../hooks/useUi2Theme';

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
  innerBg,
  style,
  innerStyle,
}: GradientBorderCardProps) {
  const { c } = useUi2Theme();
  const innerRadius = borderRadius - borderWidth;

  return (
    <LinearGradient
      colors={[c.primary, c.slab]}
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
            backgroundColor: innerBg ?? c.card,
            borderRadius: innerRadius,
            borderWidth: 1,
            borderColor: c.cardBorder,
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
