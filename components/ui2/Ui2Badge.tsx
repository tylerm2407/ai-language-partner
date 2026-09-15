/**
 * Ui2Badge — the UI 2.0 counterpart to `components/ui/Badge.tsx`.
 *
 * Same props and the same three-word variant vocabulary
 * (`primary` / `success` / `warning`), so call sites port unchanged.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL
 *
 * A badge always carries a `label`, which is what keeps this compliant with
 * the "status must never be colour-only" rule — the variant tints it, the
 * words say it. `icon` is offered on top of that for badges whose label is a
 * bare number or a level code, where the word alone does not say what kind of
 * thing it is.
 *
 * WHY THE SUCCESS AND WARNING LABELS ARE `ink`, NOT THEIR OWN HUE
 *
 * The old badge painted the text in the semantic colour (`text-success` on
 * `bg-success-bg`). UI 2.0's `green` (#33C48D) and `yellow` (#FFC857) are
 * saturated fills chosen to be seen at 20px, not read at 12px: green on
 * greenTint lands near 2:1, well under AA. Only `primary` has a purpose-built
 * on-tint colour (`onTint`, which exists precisely because `primary` itself is
 * 4.4:1 there). So the fill and the 2px border carry the hue and the label
 * stays `ink`, which clears AA against every tint in both schemes.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { Ui2Palette } from '../../config/theme';
import { Caption } from './Ui2Text';

export type Ui2BadgeVariant = 'primary' | 'success' | 'warning';

interface Ui2BadgeProps {
  label: string;
  variant?: Ui2BadgeVariant;
  /** Optional leading glyph, for badges whose label is a number or a code. */
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

export interface Ui2BadgeColors {
  bg: string;
  border: string;
  text: string;
}

/** Pure so the variant table can be asserted without a render harness. */
export function badgeColors(c: Ui2Palette, variant: Ui2BadgeVariant): Ui2BadgeColors {
  switch (variant) {
    case 'success':
      return { bg: c.greenTint, border: c.greenBorder, text: c.ink };
    case 'warning':
      return { bg: c.yellowTint, border: c.yellowBorder, text: c.ink };
    default:
      return { bg: c.primaryTint, border: c.primaryTintBorder, text: c.onTint };
  }
}

export function Ui2Badge({ label, variant = 'primary', icon, style }: Ui2BadgeProps) {
  const { c, shape } = useUi2Theme();
  const { bg, border, text } = badgeColors(c, variant);

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderColor: border, borderWidth: shape.border },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      {icon ? <Ionicons name={icon} size={12} color={text} /> : null}
      {/* `Caption` rather than a raw Text so the badge inherits the Nunito
          stack and the Dynamic Type ceiling with everything else. */}
      <Caption style={{ color: text }}>
        {label}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
});
