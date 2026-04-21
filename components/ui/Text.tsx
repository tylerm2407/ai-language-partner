/**
 * Typography primitives — enforce a consistent scale + semantic color.
 *
 * Usage:
 *   <Heading level={1}>Learn</Heading>
 *   <Body>Message content</Body>
 *   <Caption>Stat label</Caption>
 *   <Hero>Nailed it!</Hero>  // display face (PlayfairDisplay), celebration moments
 *
 * All wrappers default color to text.primary; pass `tone="secondary"` /
 * `tone="tertiary"` / `tone="onPrimary"` / tone="accent" to override.
 */

import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, typography } from '../../config/theme';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'onPrimary' | 'accent' | 'success' | 'error' | 'warning';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

function toneColor(tone: Tone): string {
  switch (tone) {
    case 'secondary':
      return colors.text.secondary;
    case 'tertiary':
      return colors.text.tertiary;
    case 'onPrimary':
      return colors.text.onPrimary;
    case 'accent':
      return colors.indigo[400];
    case 'success':
      return colors.success.light;
    case 'error':
      return colors.error.light;
    case 'warning':
      return colors.warning.light;
    default:
      return colors.text.primary;
  }
}

function familyFor(weight: Weight): string {
  return typography.family[weight];
}

// ─── Heading ─────────────────────────────────────────────────────────────
interface HeadingProps extends TextProps {
  level?: 1 | 2 | 3;
  tone?: Tone;
  children: React.ReactNode;
}
export function Heading({ level = 1, tone = 'primary', style, children, ...rest }: HeadingProps) {
  const size = level === 1 ? typography.scale.h1 : level === 2 ? typography.scale.h2 : typography.scale.h3;
  const baseStyle: TextStyle = {
    fontSize: size.fontSize,
    lineHeight: size.lineHeight,
    color: toneColor(tone),
    fontFamily: familyFor(size.weight),
  };
  return (
    <RNText
      accessibilityRole="header"
      style={[baseStyle, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

// ─── Body ────────────────────────────────────────────────────────────────
interface BodyProps extends TextProps {
  size?: 'lg' | 'md' | 'sm';
  tone?: Tone;
  weight?: Weight;
  children: React.ReactNode;
}
export function Body({ size = 'md', tone = 'primary', weight, style, children, ...rest }: BodyProps) {
  const scale = size === 'lg' ? typography.scale.bodyLg : size === 'sm' ? typography.scale.bodySm : typography.scale.body;
  const effectiveWeight = weight ?? scale.weight;
  const baseStyle: TextStyle = {
    fontSize: scale.fontSize,
    lineHeight: scale.lineHeight,
    color: toneColor(tone),
    fontFamily: familyFor(effectiveWeight),
  };
  return <RNText style={[baseStyle, style]} {...rest}>{children}</RNText>;
}

// ─── Caption ─────────────────────────────────────────────────────────────
interface CaptionProps extends TextProps {
  tone?: Tone;
  size?: 'md' | 'sm'; // md = 13 (caption), sm = 12 (tiny)
  children: React.ReactNode;
}
export function Caption({ tone = 'secondary', size = 'md', style, children, ...rest }: CaptionProps) {
  const scale = size === 'sm' ? typography.scale.tiny : typography.scale.caption;
  const baseStyle: TextStyle = {
    fontSize: scale.fontSize,
    lineHeight: scale.lineHeight,
    color: toneColor(tone),
    fontFamily: familyFor(scale.weight),
  };
  return <RNText style={[baseStyle, style]} {...rest}>{children}</RNText>;
}

// ─── Hero (celebration-only display face) ────────────────────────────────
interface HeroProps extends TextProps {
  tone?: Tone;
  children: React.ReactNode;
}
export function Hero({ tone = 'primary', style, children, ...rest }: HeroProps) {
  const baseStyle: TextStyle = {
    fontSize: typography.scale.hero.fontSize,
    lineHeight: typography.scale.hero.lineHeight,
    color: toneColor(tone),
    fontFamily: typography.family.display,
  };
  return <RNText style={[baseStyle, style]} {...rest}>{children}</RNText>;
}
