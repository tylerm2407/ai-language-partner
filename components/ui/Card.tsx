import { View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { ui2Shape, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface CardProps {
  children: ReactNode;
  variant?: 'standard' | 'exercise';
  style?: ViewStyle;
}

/**
 * The UI 2.0 surface: a 2px outline with a thicker bottom edge, same shape as
 * `components/ui2/SlabCard.tsx`. The old dark drop shadow is gone — the slab
 * edge is what supplies depth now, and a shadow tuned for a near-black ground
 * is invisible on a white one.
 */
const variantStyles = (c: Ui2Palette): Record<'standard' | 'exercise', ViewStyle> => ({
  standard: {
    backgroundColor: c.card,
    borderColor: c.cardBorder,
    borderWidth: ui2Shape.border,
    borderBottomWidth: ui2Shape.slab,
    borderRadius: ui2Shape.radiusCard,
    padding: 20,
  },
  exercise: {
    backgroundColor: c.card,
    borderColor: c.cardBorder,
    borderWidth: ui2Shape.border,
    borderBottomWidth: ui2Shape.slab,
    borderRadius: ui2Shape.radiusHero,
    padding: 24,
    minHeight: 200,
  },
});

export function Card({ children, variant = 'standard', style }: CardProps) {
  const { c } = useUi2Theme();
  return (
    <View style={[variantStyles(c)[variant], style]}>
      {children}
    </View>
  );
}
