/**
 * MagazineGlassCard — the editorial card shell. The name is historical; the
 * blur is gone.
 *
 * Was: iOS BlurView at intensity 40 over a translucent fill, with an opaque
 * Android fallback — so the two platforms never actually matched. Now a single
 * opaque surface.card + 1px border on both, which is what the Dark Glow deck
 * specifies: flat cards, depth supplied by the ambient glow behind them.
 *
 * radius xxl (20) / padding 20 — matches NewsHeroCard, SessionBand, LessonTile.
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radii } from '../../config/theme';

interface MagazineGlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function MagazineGlassCard({ children, style }: MagazineGlassCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.card,
    padding: 20,
    overflow: 'hidden',
  },
});
