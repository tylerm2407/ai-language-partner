/**
 * GradientBackground — REDESIGNED (Phase 0).
 *
 * Formerly: a looping cross-fading galaxy video under every screen.
 * Now: a calm solid dark surface. The name is preserved for backward
 * compatibility with ~32 screens that import this component; new code
 * should use <Surface> from './Surface' directly.
 *
 * Why the change:
 *   - Mayer's Coherence Principle (d ≈ 0.86): extraneous animation hurts
 *     learning.
 *   - Apple HIG + App Store Reduced Motion Evaluation Criteria: multi-axis
 *     motion must honor accessibility settings.
 *   - Universal pattern among retention-winning learning apps (Duolingo,
 *     Babbel, Headspace, Khan Academy): no looping video behind content.
 *
 * See design-research.md for citations and redesign-plan.md for scope.
 */

import React from 'react';
import { View, type ViewStyle, StyleSheet } from 'react-native';
import { colors } from '../../config/theme';

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Optional surface variant. Defaults to 'base'. 'raised' is slightly
   *  lighter and used for reading/lesson/review surfaces where sustained
   *  focus on text/exercises benefits from a subtle step-up in lightness. */
  variant?: 'base' | 'raised';
}

export function GradientBackground({
  children,
  style,
  variant = 'base',
}: GradientBackgroundProps) {
  const backgroundColor =
    variant === 'raised' ? colors.surface.raised : colors.surface.base;

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
