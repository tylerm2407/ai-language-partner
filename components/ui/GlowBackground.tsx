/**
 * GlowBackground — the screen background wrapper.
 *
 * WHAT CHANGED, AND WHY THE BLOBS ARE GONE
 *
 * Under Dark Glow this file was the ambient layer: three low-opacity
 * indigo/violet radial blobs drifting between the base fill and screen content.
 * That effect only exists on a dark ground. UI 2.0 ("Tactile") has no glow
 * vocabulary at all — DESIGN.md's migration table is explicit that
 * `GlowBackground` / `GradientBackground` map to "nothing — UI 2.0 grounds on
 * flat `c.bg`" — and there is no honest light-mode translation of a glow: the
 * same blobs on white are either invisible or a violet wash that appears
 * nowhere else in the system. Retinting them to the UI 2.0 palette would have
 * been inventing a look rather than migrating one, so the layer is gone and the
 * ground is flat.
 *
 * Both exports are KEPT, with their prop types unchanged, so no call site has
 * to change in the same commit: `GlowBackground` is now a plain themed
 * container, and `GlowLayer` renders nothing. `drift` is still accepted and
 * still means "may this background animate" — there is simply nothing left to
 * animate. New screens should use `components/ui2/Ui2Screen` instead.
 */

import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface GlowLayerProps {
  /** Accepted for API compatibility. UI 2.0 has no ambient layer to animate. */
  drift?: boolean;
}

/**
 * GlowLayer — retained as a no-op.
 *
 * It used to be the absolutely-positioned blob layer, dropped in as the first
 * child of a screen that owned its own root container. UI 2.0 has no such
 * layer; screens ground on a flat `c.bg`. Kept exported so the handful of call
 * sites (and the test that mocks it) keep resolving.
 */
export function GlowLayer(_props: GlowLayerProps) {
  return null;
}

interface GlowBackgroundProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Screen-level fill. Defaults to the scheme's ground, `c.bg`. */
  backgroundColor?: string;
  /** Accepted for API compatibility; nothing animates any more. */
  drift?: boolean;
}

export function GlowBackground({
  children,
  style,
  backgroundColor,
  drift = true,
}: GlowBackgroundProps) {
  const { c } = useUi2Theme();
  return (
    <View style={[styles.container, { backgroundColor: backgroundColor ?? c.bg }, style]}>
      <GlowLayer drift={drift} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
