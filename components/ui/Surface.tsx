/**
 * Surface — canonical screen/chrome background wrapper.
 *
 * This is the forward-going primitive; <GradientBackground> is a backward-
 * compatible alias with the same behavior (new code should prefer <Surface>).
 */

import React from 'react';
import { View, SafeAreaView, type ViewStyle, StyleSheet } from 'react-native';
import { colors } from '../../config/theme';

interface SurfaceProps {
  children: React.ReactNode;
  /** 'base' = primary app background (#0C0F14). 'raised' = slightly lighter
   *  (#12161D) for reading/lesson/review where sustained focus benefits from
   *  the contrast step. 'card' for inline card tiles. */
  variant?: 'base' | 'raised' | 'card' | 'cardAlt';
  /** If true, wraps children in SafeAreaView. Default: false. */
  safe?: boolean;
  style?: ViewStyle;
}

export function Surface({ children, variant = 'base', safe = false, style }: SurfaceProps) {
  const backgroundColor =
    variant === 'raised'
      ? colors.surface.raised
      : variant === 'card'
        ? colors.surface.card
        : variant === 'cardAlt'
          ? colors.surface.cardAlt
          : colors.surface.base;

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
