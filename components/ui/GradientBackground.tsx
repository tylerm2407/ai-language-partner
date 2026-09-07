/**
 * GradientBackground — the app's single screen-background entry point.
 *
 * Variants:
 *   `base` / `cosmic` (default) — the scheme ground, `c.bg`.
 *   `raised` — the second ground step, `c.surface2`. Learning surfaces (lesson
 *      runner, writing prompt, drills) keep a contrast step from the rest of
 *      the app.
 *   `plain` — solid `c.bg`. Sheets, modals, and anything that already sits over
 *      a scrim.
 *
 * `cosmic` is retained as an alias of `base` so existing call sites keep
 * working unchanged. The name is now historical in a second way too: under
 * UI 2.0 there is no gradient and no glow here — DESIGN.md maps this component
 * to a flat `c.bg`, and `GlowBackground` is a plain themed container. The four
 * variants survive because they are the public API, not because they still
 * describe four different effects.
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';
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
  const { c } = useUi2Theme();

  if (variant === 'plain') {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg }, style]}>
        {children}
      </View>
    );
  }

  if (variant === 'raised') {
    return (
      <GlowBackground style={style} backgroundColor={c.surface2} drift={false}>
        {children}
      </GlowBackground>
    );
  }

  return <GlowBackground style={style}>{children}</GlowBackground>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
