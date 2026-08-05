/**
 * Device-relative sizing for display type.
 *
 * The design baseline is a 390pt-wide window (iPhone 14/15/16 — what the Dark
 * Glow deck was drawn at). Narrow phones get slightly smaller headings so page
 * titles keep their line count instead of wrapping or truncating; large phones
 * get slightly larger ones so titles don't look lost.
 *
 * Only *display type* scales this way — headings and the hero. Body, caption
 * and mono steps stay fixed, because iOS already governs reading size through
 * Dynamic Type and overriding that per-device fights the platform (and both
 * platforms scale our lineHeight along with fontSize, so the ratio survives).
 *
 * The clamp is deliberately narrow. Width scaling is for headline fit, not
 * readability, and unbounded scaling turns a tablet into a billboard.
 */

import { useWindowDimensions } from 'react-native';

/** Window width the type scale was designed against. */
export const BASELINE_WIDTH = 390;

const MIN_SCALE = 0.88;
const MAX_SCALE = 1.1;

/** Pure form, for tests and StyleSheet-time use. */
export function displayScale(windowWidth: number): number {
  const raw = windowWidth / BASELINE_WIDTH;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
}

/**
 * Multiplier to apply to display fontSize. Reacts to rotation and split-screen
 * because it reads `useWindowDimensions()` rather than a module-level snapshot.
 */
export function useDisplayScale(): number {
  const { width } = useWindowDimensions();
  return displayScale(width);
}
