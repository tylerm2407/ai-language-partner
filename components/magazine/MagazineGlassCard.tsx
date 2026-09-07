/**
 * MagazineGlassCard — the editorial card shell. The name is historical; the
 * blur is gone.
 *
 * Was: iOS BlurView at intensity 40 over a translucent fill, with an opaque
 * Android fallback — so the two platforms never actually matched. Then a single
 * opaque card + 1px border on both.
 *
 * Now it is the UI 2.0 slab: `card` fill, a 2px outline and a 5px bottom edge
 * (`ui2Shape.slab`), radius 18. The outline is what makes a card a card once
 * the ground can be white — the Dark Glow version leaned on the glow behind it,
 * and there is no glow any more. Padding stays 20, matching NewsHeroCard,
 * SessionBand and LessonTile.
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { ui2Dark, ui2Light, ui2Shape, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface MagazineGlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function MagazineGlassCard({ children, style }: MagazineGlassCardProps) {
  const { scheme } = useUi2Theme();
  return <View style={[themed[scheme].card, style]}>{children}</View>;
}

const makeStyles = (c: Ui2Palette) =>
  StyleSheet.create({
    card: {
      borderRadius: ui2Shape.radiusCard,
      borderWidth: ui2Shape.border,
      borderBottomWidth: ui2Shape.slab,
      borderColor: c.cardBorder,
      backgroundColor: c.card,
      padding: 20,
      overflow: 'hidden',
    },
  });

/** Both schemes built once at module load — see DateLabel for why. */
const themed = { light: makeStyles(ui2Light), dark: makeStyles(ui2Dark) } as const;
