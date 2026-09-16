/**
 * SlabCard — the UI 2.0 card. A filled block with no outline (Tint blocks,
 * 2026-09-07); the slab keys in `ui2Shape` are 0 and the name is historical.
 *
 * `clay` (Home, 2026-09-16) is the Home treatment: a soft volume on the lilac
 * `clayGround` — `clayCard` fill, a larger radius and the three-shadow stack
 * from `useClay().card`. Everywhere else a card stays a flat tint block.
 */
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';

export type SlabTint = 'card' | 'primary' | 'yellow' | 'green' | 'pink';

interface SlabCardProps extends ViewProps {
  tint?: SlabTint;
  /** Larger radius for the one hero block on a screen. */
  hero?: boolean;
  /** Soft clay volume; ignores `tint`. Home only; see the file header. */
  clay?: boolean;
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

/** Radius of a clay card. Rounder than a tint block: a volume, not a slab. */
export const CLAY_RADIUS = 30;

/** `#RRGGBB` plus an alpha byte, for a drop shadow tinted by its own fill. */
function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

/**
 * The clay shadow stacks (canvas "Fluenci Home · Depth", board 4). RN 0.81's
 * `boxShadow` draws `inset` layers over the view's own background and under
 * its children, so a clay surface must carry its colour itself rather than
 * in a child that fills it (`ClayOverlay` covers the case where it cannot).
 *
 * - `card`   — a raised volume: light edge, inner shade, soft drop.
 * - `well`   — a sunken groove: one inner shadow from the top.
 * - `bowl`   — a shallow dish pressed into a card (the level ring's socket).
 * - `raised(fill)` — a solid pill or tile that looks pressable; its drop takes
 *   the fill's own hue, so a green pill glows green. `fill` must be `#RRGGBB`.
 */
export function useClay() {
  const { c } = useUi2Theme();
  return {
    card: {
      backgroundColor: c.clayCard,
      borderRadius: CLAY_RADIUS,
      boxShadow: `inset 4px 4px 10px ${c.clayRim}, inset -6px -8px 16px ${c.clayShade}, 10px 16px 30px -12px ${c.clayDrop}`,
    } satisfies ViewStyle,
    well: { boxShadow: `inset 0px 2px 3px ${c.clayWell}` } satisfies ViewStyle,
    bowl: { boxShadow: `inset 3px 3px 6px ${c.clayRim}, inset -4px -5px 10px ${c.clayShade}` } satisfies ViewStyle,
    raised: (fill: string): ViewStyle => ({
      backgroundColor: fill,
      boxShadow: `inset 3px 3px 6px rgba(255,255,255,0.4), inset -4px -5px 10px rgba(0,0,0,0.18), 0px 10px 18px -8px ${withAlpha(fill, 0.75)}`,
    }),
  };
}

/**
 * The clay light and shade for a surface whose colour comes from a child (a
 * gradient or an SVG mesh), which would otherwise paint over its own inset
 * shadows. Mount it after that child; it draws the two inner shadows on a
 * transparent layer with the parent's radius and takes no touches.
 */
export function ClayOverlay({ radius, rim, shade }: { radius: number; rim: string; shade: string }) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: `inset 5px 6px 14px ${rim}, inset -8px -10px 22px ${shade}` }]}
    />
  );
}

/**
 * The soft lift the Tutor tab's surfaces share. iOS draws the shadow; Android
 * gets `elevation`, which is why the shadow stays soft and low-opacity.
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

export function SlabCard({ tint = 'card', hero, clay, style, children, ...rest }: SlabCardProps) {
  const { shape } = useUi2Theme();
  const solid = useSlabTint(tint);
  const clayCard = useClay().card;
  return (
    <View
      {...rest}
      style={[
        styles.card,
        clay
          ? clayCard
          : {
              backgroundColor: solid.bg,
              borderColor: solid.border,
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
