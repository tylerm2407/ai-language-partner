/**
 * GradientBackground — the app's single screen-background entry point.
 *
 * Variants:
 *   `base` / `cosmic` (default) — the Dark Glow ambient: surface.base with the
 *      drifting indigo/violet blob layer. See components/ui/GlowBackground.tsx.
 *   `raised` — the same glow WITHOUT drift, on surface.raised. Learning
 *      surfaces (lesson runner, writing prompt, drills) keep the theme's depth
 *      but spend no motion, per Mayer's coherence principle.
 *   `plain` — solid surface.base, no glow. Sheets, modals, and anything that
 *      already sits over a scrim.
 *
 * `cosmic` is retained as an alias of `base` so existing call sites keep
 * working unchanged.
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors } from '../../config/theme';
import { GlowBackground } from './GlowBackground';

type Variant = 'base' | 'cosmic' | 'raised' | 'plain';

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: Variant;
}

export function GradientBackground({
  children,
  style,
  variant = 'base',
}: GradientBackgroundProps) {
  if (variant === 'plain') {
    return (
      <View style={[styles.flex, { backgroundColor: colors.surface.base }, style]}>
        {children}
      </View>
    );
  }

  if (variant === 'raised') {
    return (
      <GlowBackground style={style} backgroundColor={colors.surface.raised} drift={false}>
        {children}
      </GlowBackground>
    );
  }

  return <GlowBackground style={style}>{children}</GlowBackground>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
