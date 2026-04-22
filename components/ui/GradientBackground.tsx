/**
 * GradientBackground — Aurora ambient (default) + focus variants.
 *
 * Default (`variant="base"` or `variant="cosmic"`): the Claude Design
 * aurora background — deep navy base with animated aurora glow blobs,
 * twinkling starfield, diagonal light band, and film grain.
 *
 * Focus (`variant="raised"`): calm, motion-free surface.raised — used on
 *   learning surfaces (lesson runner, writing prompt) where Mayer's
 *   coherence principle requires zero decorative motion.
 *
 * Plain (`variant="plain"`): pure solid surface.base — used by sheets/modals.
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors } from '../../config/theme';
import { AuroraBackground } from './AuroraBackground';

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
  if (variant === 'raised') {
    return (
      <View style={[styles.flex, { backgroundColor: colors.surface.raised }, style]}>
        {children}
      </View>
    );
  }
  if (variant === 'plain') {
    return (
      <View style={[styles.flex, { backgroundColor: colors.surface.base }, style]}>
        {children}
      </View>
    );
  }
  return (
    <AuroraBackground style={style}>
      {children}
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
