/**
 * UI 2.0 typography — the Tactile counterpart to `components/ui/Text.tsx`.
 *
 * WHY THIS MIRRORS THE OLD API EXACTLY
 *
 * `Heading` / `Body` / `Caption` / `Hero` keep the same names, the same props
 * and the same `Tone` vocabulary as the Dark Glow originals. That is the whole
 * design of this file: migrating a screen becomes a one-line import swap rather
 * than a rewrite of every text node on it, and a screen half-converted is
 * immediately obvious because the import path is the only thing that changed.
 *
 * DESIGN.md is explicit that the two systems must not be mixed on one screen,
 * so this exists to make converting a whole screen cheap enough that nobody is
 * tempted to convert half of it.
 *
 * The type scale itself is unchanged — the sizes were tuned against Dynamic
 * Type ceilings and re-tuning them is a separate decision from re-theming. What
 * changes is the FAMILY (Plus Jakarta Sans for headings, Nunito for UI, per
 * `ui2Type`) and the COLOUR, which now comes from the scheme-aware palette
 * instead of a fixed dark one.
 */
import { Text as RNText, type TextProps, type StyleProp, type TextStyle } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';

/** Same vocabulary as components/ui/Text.tsx, so call sites port unchanged. */
export type Ui2Tone =
  | 'primary' | 'secondary' | 'tertiary' | 'onPrimary'
  | 'accent' | 'success' | 'error' | 'warning';

/** Dynamic Type ceilings, carried over from the Dark Glow scale. Each exists so
 *  a large-text user gets bigger copy without the layout clipping. */
const MAX_SCALE = { heading: 1.4, body: 1.6, caption: 1.6, hero: 1.3 } as const;

function useToneColor(tone: Ui2Tone): string {
  const { c } = useUi2Theme();
  switch (tone) {
    case 'secondary': return c.muted;
    case 'tertiary': return c.idle;
    case 'onPrimary': return c.onPrimary;
    case 'accent': return c.onTint;
    case 'success': return c.green;
    case 'error': return c.error;
    case 'warning': return c.yellow;
    default: return c.ink;
  }
}

interface Ui2HeadingProps extends TextProps {
  level?: 1 | 2 | 3;
  tone?: Ui2Tone;
  children: React.ReactNode;
}

export function Heading({ level = 1, tone = 'primary', style, children, ...rest }: Ui2HeadingProps) {
  const { type } = useUi2Theme();
  const color = useToneColor(tone);
  const size = level === 1 ? 28 : level === 2 ? 22 : 18;
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={MAX_SCALE.heading}
      style={[
        { fontFamily: type.heading, fontSize: size, lineHeight: Math.round(size * 1.22), color },
        style as StyleProp<TextStyle>,
      ]}
    >
      {children}
    </RNText>
  );
}

interface Ui2BodyProps extends TextProps {
  size?: 'sm' | 'md' | 'lg';
  tone?: Ui2Tone;
  /** Full Dark Glow vocabulary, mirrored so call sites port unchanged. UI 2.0
   *  ships three Nunito weights, so the five names fold onto them: regular and
   *  medium share 600, semibold and bold share 700, extrabold takes 800.
   *  Folding rather than rejecting is deliberate — a migration should not fail
   *  to compile over a weight name that has no exact counterpart. */
  weight?: 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  children: React.ReactNode;
}

export function Body({ size = 'md', tone = 'primary', weight = 'regular', style, children, ...rest }: Ui2BodyProps) {
  const { type } = useUi2Theme();
  const color = useToneColor(tone);
  const px = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;
  const family =
    weight === 'extrabold' ? type.uiHeavy
      : weight === 'bold' || weight === 'semibold' ? type.uiBold
      : type.ui;
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={MAX_SCALE.body}
      style={[
        { fontFamily: family, fontSize: px, lineHeight: Math.round(px * 1.45), color },
        style as StyleProp<TextStyle>,
      ]}
    >
      {children}
    </RNText>
  );
}

interface Ui2CaptionProps extends TextProps {
  tone?: Ui2Tone;
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

export function Caption({ tone = 'secondary', size = 'md', style, children, ...rest }: Ui2CaptionProps) {
  const { type } = useUi2Theme();
  const color = useToneColor(tone);
  const px = size === 'sm' ? 11 : 13;
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={MAX_SCALE.caption}
      style={[
        { fontFamily: type.ui, fontSize: px, lineHeight: Math.round(px * 1.4), color },
        style as StyleProp<TextStyle>,
      ]}
    >
      {children}
    </RNText>
  );
}

interface Ui2HeroProps extends TextProps {
  tone?: Ui2Tone;
  children: React.ReactNode;
}

export function Hero({ tone = 'primary', style, children, ...rest }: Ui2HeroProps) {
  const { type } = useUi2Theme();
  const color = useToneColor(tone);
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={MAX_SCALE.hero}
      style={[
        { fontFamily: type.heading, fontSize: 36, lineHeight: 40, color },
        style as StyleProp<TextStyle>,
      ]}
    >
      {children}
    </RNText>
  );
}
