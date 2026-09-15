/**
 * Typography primitives — enforce a consistent scale + semantic color.
 *
 * Usage:
 *   <Heading level={1}>Learn</Heading>
 *   <Body>Message content</Body>
 *   <Caption>Stat label</Caption>
 *   <Hero>Nailed it!</Hero>  // display face (Fraunces), celebration moments
 *
 * All wrappers default color to the scheme's ink; pass `tone="secondary"` /
 * `tone="tertiary"` / `tone="onPrimary"` / tone="accent" to override.
 *
 * COLOUR COMES FROM `useUi2Theme()`, not the fixed dark `colors` palette. These
 * primitives render inside screens that are already on UI 2.0, so a fixed dark
 * ink here is invisible on a developer's dark phone and unreadable on a light
 * one. The type scale, the weights and the Dynamic Type ceilings below are
 * scheme-independent and are deliberately untouched.
 *
 * DYNAMIC TYPE
 * React Native's `allowFontScaling` defaults to true and nothing in this tree
 * turns it off, so every one of these — and every raw <Text> — already grows
 * with the iOS Larger Text slider. The problem is the other end: that slider
 * reaches 310% at the accessibility sizes, and a container sized for 15pt body
 * copy does not survive 46pt. What App Review's Larger Text pass actually
 * catches is clipped and overlapping text, not text that failed to grow.
 *
 * So each primitive carries a ceiling rather than a switch. The caps below are
 * headroom for readability with a stop before layout death, and a caller can
 * raise or lower one by passing `maxFontSizeMultiplier` — it lands in `...rest`
 * and wins over the default.
 *
 * Body and Caption get the most room (1.6) because they are the reading sizes
 * and the ones a low-vision learner is actually adjusting for; they also live
 * in flow layout that can grow. Heading (1.4) and Hero (1.3) get less: they
 * start large, they sit in headers and celebration cards with less vertical
 * slack, and they are already device-scaled by `useDisplayScale` on top of
 * whatever the user's setting contributes.
 */

import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { minLineHeight, typography, type Ui2Palette } from '../../config/theme';
import { useDisplayScale } from '../../hooks/useDisplayScale';
import { useUi2Theme } from '../../hooks/useUi2Theme';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'onPrimary' | 'accent' | 'success' | 'error' | 'warning';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

/**
 * The tone vocabulary is unchanged; only where the colour comes from changed.
 * `c` is passed in rather than read from a module import so this stays a pure
 * function — the palette is scheme-dependent and only a component can know it.
 * The mapping mirrors components/ui2/Ui2Text.tsx exactly, so the two families
 * of primitive cannot drift apart on the same screen.
 */
function toneColor(tone: Tone, c: Ui2Palette): string {
  switch (tone) {
    case 'secondary':
      return c.muted;
    case 'tertiary':
      return c.idle;
    case 'onPrimary':
      return c.onPrimary;
    case 'accent':
      return c.onTint;
    case 'success':
      return c.green;
    case 'error':
      return c.error;
    case 'warning':
      return c.yellow;
    default:
      return c.ink;
  }
}

function familyFor(weight: Weight): string {
  return typography.family[weight];
}

/** Dynamic Type ceilings — see the file header for why each is where it is. */
const MAX_SCALE = {
  heading: 1.4,
  body: 1.6,
  caption: 1.6,
  hero: 1.3,
} as const;

// ─── Heading ─────────────────────────────────────────────────────────────
interface HeadingProps extends TextProps {
  level?: 1 | 2 | 3;
  tone?: Tone;
  children: React.ReactNode;
}
export function Heading({ level = 1, tone = 'primary', style, children, ...rest }: HeadingProps) {
  const { c } = useUi2Theme();
  const scale = useDisplayScale();
  const size = level === 1 ? typography.scale.h1 : level === 2 ? typography.scale.h2 : typography.scale.h3;
  const fontSize = Math.round(size.fontSize * scale);
  const baseStyle: TextStyle = {
    fontSize,
    // Floored at the face's natural line box for the *scaled* size, so the
    // no-clip invariant holds at every device width — not just at baseline.
    lineHeight: Math.max(minLineHeight(fontSize), Math.round(size.lineHeight * scale)),
    color: toneColor(tone, c),
    fontFamily: familyFor(size.weight),
    letterSpacing: typography.tracking.heading,
  };
  return (
    <RNText
      accessibilityRole="header"
      maxFontSizeMultiplier={MAX_SCALE.heading}
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
  const { c } = useUi2Theme();
  const scale = size === 'lg' ? typography.scale.bodyLg : size === 'sm' ? typography.scale.bodySm : typography.scale.body;
  const effectiveWeight = weight ?? scale.weight;
  const baseStyle: TextStyle = {
    fontSize: scale.fontSize,
    lineHeight: scale.lineHeight,
    color: toneColor(tone, c),
    fontFamily: familyFor(effectiveWeight),
  };
  return (
    <RNText maxFontSizeMultiplier={MAX_SCALE.body} style={[baseStyle, style]} {...rest}>
      {children}
    </RNText>
  );
}

// ─── Caption ─────────────────────────────────────────────────────────────
interface CaptionProps extends TextProps {
  tone?: Tone;
  size?: 'md' | 'sm'; // md = 13 (caption), sm = 12 (tiny)
  children: React.ReactNode;
}
export function Caption({ tone = 'secondary', size = 'md', style, children, ...rest }: CaptionProps) {
  const { c } = useUi2Theme();
  const scale = size === 'sm' ? typography.scale.tiny : typography.scale.caption;
  const baseStyle: TextStyle = {
    fontSize: scale.fontSize,
    lineHeight: scale.lineHeight,
    color: toneColor(tone, c),
    fontFamily: familyFor(scale.weight),
  };
  return (
    <RNText maxFontSizeMultiplier={MAX_SCALE.caption} style={[baseStyle, style]} {...rest}>
      {children}
    </RNText>
  );
}

// ─── Hero (celebration-only display face) ────────────────────────────────
interface HeroProps extends TextProps {
  tone?: Tone;
  children: React.ReactNode;
}
export function Hero({ tone = 'primary', style, children, ...rest }: HeroProps) {
  const { c } = useUi2Theme();
  const scale = useDisplayScale();
  const fontSize = Math.round(typography.scale.hero.fontSize * scale);
  const baseStyle: TextStyle = {
    fontSize,
    // 'display' leading — Fraunces needs more room than Nunito.
    lineHeight: Math.max(
      minLineHeight(fontSize, 'display'),
      Math.round(typography.scale.hero.lineHeight * scale),
    ),
    color: toneColor(tone, c),
    fontFamily: typography.family.display,
    letterSpacing: -0.8,
  };
  return (
    <RNText maxFontSizeMultiplier={MAX_SCALE.hero} style={[baseStyle, style]} {...rest}>
      {children}
    </RNText>
  );
}
