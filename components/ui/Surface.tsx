/**
 * Surface — canonical screen/chrome background wrapper.
 *
 * This is the forward-going primitive; <GradientBackground> is a backward-
 * compatible alias with the same behavior (new code should prefer <Surface>).
 *
 * UI 2.0: the fills come from `useUi2Theme()` so the wrapper follows the
 * phone's light/dark setting. UI 2.0 has two ground steps rather than four —
 * `bg` and `surface2` — plus the card fill, so `raised` and `cardAlt` both
 * resolve to `surface2`. Keeping four names is deliberate: they are the public
 * API and every call site keeps compiling.
 */

import React from 'react';
import { View, SafeAreaView, type ViewStyle, StyleSheet } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface SurfaceProps {
  children: React.ReactNode;
  /** 'base' = primary app background. 'raised' = the second ground step, for
   *  reading/lesson/review where sustained focus benefits from the contrast.
   *  'card' for inline card tiles; 'cardAlt' shares the raised step. */
  variant?: 'base' | 'raised' | 'card' | 'cardAlt';
  /** If true, wraps children in SafeAreaView. Default: false. */
  safe?: boolean;
  style?: ViewStyle;
}

export function Surface({ children, variant = 'base', safe = false, style }: SurfaceProps) {
  const { c } = useUi2Theme();
  const backgroundColor =
    variant === 'raised'
      ? c.surface2
      : variant === 'card'
        ? c.card
        : variant === 'cardAlt'
          ? c.surface2
          : c.bg;

  if (safe) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor }, style]}>
        {children}
      </SafeAreaView>
    );
  }
  return (
    <View style={[styles.flex, { backgroundColor }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
