/**
 * Mono — the tracked uppercase meta label used across the Learn screen.
 *
 * Every small label on this screen (`8 UNITS · 48 LESSONS`, `38% MASTERED`,
 * `+20 XP`, `MILESTONE`, the lesson index) is JetBrains Mono at eyebrow
 * tracking. Pulling it into one component keeps the face, size and tracking
 * from drifting apart across the four files that render it.
 *
 * Not folded into components/ui2/Ui2Text.tsx because that module's primitives are
 * scale steps (`Body`, `Caption`); this is a single named editorial treatment.
 */

import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { minLineHeight, typography } from '../../config/theme';

interface MonoProps extends TextProps {
  /** 11 for row meta, 12 for section eyebrows. */
  size?: 11 | 12;
  /** Required: UI 2.0 colour comes from `useUi2Theme()`, which a module-level
   *  default cannot read. Callers pass the token, so the label can never fall
   *  back to a colour that is wrong in one of the two schemes. */
  color: string;
  medium?: boolean;
  children: React.ReactNode;
}

/** Matches the caption ceiling in components/ui2/Ui2Text.tsx. */
const MAX_FONT_SCALE = 1.6;

export function Mono({
  size = 12,
  color,
  medium = false,
  style,
  children,
  ...rest
}: MonoProps) {
  const baseStyle: TextStyle = {
    fontFamily: medium ? typography.family.monoMedium : typography.family.mono,
    fontSize: size,
    lineHeight: minLineHeight(size, 'mono'),
    letterSpacing: typography.tracking.eyebrow,
    color,
  };
  return (
    <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} style={[baseStyle, style]} {...rest}>
      {children}
    </RNText>
  );
}
