/**
 * SlabCard — the UI 2.0 surface: 2px outline with a thicker bottom edge.
 * `tint` swaps in one of the semantic tints (level, read, review, unit colour).
 */
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';

export type SlabTint = 'card' | 'primary' | 'yellow' | 'green' | 'pink';

interface SlabCardProps extends ViewProps {
  tint?: SlabTint;
  /** Hero cards use the larger radius. */
  hero?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function useSlabTint(tint: SlabTint): { bg: string; border: string } {
  const { c } = useUi2Theme();
  switch (tint) {
    case 'primary':
      return { bg: c.primaryTint, border: c.primaryTintBorder };
    case 'yellow':
      return { bg: c.yellowTint, border: c.yellowBorder };
    case 'green':
      return { bg: c.greenTint, border: c.greenBorder };
    case 'pink':
      return { bg: c.pinkTint, border: c.pinkTint };
    default:
      return { bg: c.card, border: c.cardBorder };
  }
}

export function SlabCard({ tint = 'card', hero, style, children, ...rest }: SlabCardProps) {
  const { shape } = useUi2Theme();
  const { bg, border } = useSlabTint(tint);
  return (
    <View
      {...rest}
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: shape.border,
          borderBottomWidth: shape.slab,
          borderRadius: hero ? shape.radiusHero : shape.radiusCard,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
});
