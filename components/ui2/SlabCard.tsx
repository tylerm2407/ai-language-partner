/**
 * SlabCard — the UI 2.0 card. A filled block with no outline (Tint blocks,
 * 2026-09-07); the slab keys in `ui2Shape` are 0 and the name is historical.
 *
 * `glass` (Atmosphere, 2026-09-14) is the Home treatment: the same tints made
 * translucent so the colour glows drawn behind the page show through, a
 * hairline that reads as a lit edge, and a soft violet shadow that lifts the
 * card off the ground. Everywhere else a card stays opaque — the glass fills
 * only make sense over `components/ui2/home/Atmosphere.tsx`.
 */
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';

export type SlabTint = 'card' | 'primary' | 'yellow' | 'green' | 'pink';

interface SlabCardProps extends ViewProps {
  tint?: SlabTint;
  /** Larger radius for the one hero block on a screen. */
  hero?: boolean;
  /** Translucent fill + lit edge + lift. Home only; see the file header. */
  glass?: boolean;
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

/** The translucent twin of `useSlabTint`. */
export function useGlassTint(tint: SlabTint): { bg: string; border: string } {
  const { c } = useUi2Theme();
  const bg =
    tint === 'primary' ? c.glassPrimary
      : tint === 'yellow' ? c.glassYellow
        : tint === 'green' ? c.glassGreen
          : tint === 'pink' ? c.glassPink
            : c.glass;
  return { bg, border: c.glassBorder };
}

/**
 * The one lift every glass surface shares. iOS draws the shadow; Android gets
 * `elevation`, which is why the shadow stays soft and low-opacity — a hard
 * elevation shadow under a translucent card looks like a bug.
 */
export function useLiftShadow(): ViewStyle {
  const { c, scheme } = useUi2Theme();
  return {
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: scheme === 'dark' ? 0.45 : 0.16,
    shadowRadius: 18,
    elevation: 3,
  };
}

export function SlabCard({ tint = 'card', hero, glass, style, children, ...rest }: SlabCardProps) {
  const { shape } = useUi2Theme();
  const solid = useSlabTint(tint);
  const glassy = useGlassTint(tint);
  const lift = useLiftShadow();
  const { bg, border } = glass ? glassy : solid;
  return (
    <View
      {...rest}
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: glass ? 1 : shape.border,
          borderBottomWidth: glass ? 1 : shape.slab,
          borderRadius: hero ? shape.radiusHero : shape.radiusCard,
        },
        glass ? lift : null,
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
