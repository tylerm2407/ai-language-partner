/**
 * BrandRamp — the app icon's colour ramp as a gradient, in the few places
 * Home lets the logo show (canvas "Home · logo colours", S1 · Quiet, picked
 * 2026-09-10 with G1's tab bar).
 *
 * The ramp is deliberately thin on the page: a 4px line under the level, the
 * fill of each unit's progress bar, a slim mark beside today's read, the
 * week's bars and the active tab disc. Cards themselves stay one neutral
 * fill — "the brand shows in the lines, not the blocks". Everything here
 * reads the four `logo*` tokens through the palette so the reader's warm
 * variant (which never shows Home) still gets a blue-free key set.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { Ui2Palette } from '../../config/theme';

/** Cyan → sky → violet → magenta, the icon left to right. */
export function brandRamp(c: Ui2Palette): readonly [string, string, string, string] {
  return [c.logoAqua, c.logoSky, c.logoViolet, c.logoMagenta];
}

/** The icon's cool half (the left bubble). */
export function brandRampCool(c: Ui2Palette): readonly [string, string] {
  return [c.logoSky, c.logoAqua];
}

/** The icon's warm half (the right bubble). */
export function brandRampWarm(c: Ui2Palette): readonly [string, string] {
  return [c.logoViolet, c.logoMagenta];
}

/** 0–100, clamped; anything else (NaN, undefined progress) reads as 0. */
export function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

interface RampBarProps {
  /** Percent filled, 0–100. */
  pct: number;
  height?: number;
  /** The groove: on a card the ground colour, on the ground the card colour. */
  onCard?: boolean;
  style?: ViewStyle;
}

/** A thin progress line whose fill is the full ramp. */
export function RampBar({ pct, height = 4, onCard = true, style }: RampBarProps) {
  const { c } = useUi2Theme();
  const width = clampPct(pct);
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: onCard ? c.trackOnCard : c.card }, style]}>
      {width > 0 ? (
        <LinearGradient
          colors={brandRamp(c)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${width}%`, height, borderRadius: height / 2 }}
        />
      ) : null}
    </View>
  );
}

/** A full-width ramp rule — decoration, not data. */
export function RampRule({ height = 4, style }: { height?: number; style?: ViewStyle }) {
  const { c } = useUi2Theme();
  return (
    <LinearGradient
      colors={brandRamp(c)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[{ height, borderRadius: height / 2 }, style]}
    />
  );
}

/** A slim vertical mark in the warm half — the read row's badge. */
export function RampMark({ height = 36, width = 4 }: { height?: number; width?: number }) {
  const { c } = useUi2Theme();
  return (
    <LinearGradient
      colors={brandRampWarm(c)}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ width, height, borderRadius: width / 2 }}
    />
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', width: '100%' },
});
