/**
 * Atmosphere — the soft colour glows behind Home ("Home · Atmosphere",
 * picked 2026-09-14). Four radial blobs in the page's own accent colours,
 * drawn once behind the scroll content so they move with it; the glass cards
 * in front (`SlabCard glass`) let them through.
 *
 * Pure SVG: no blur filter, no BlurView. The blobs are radial gradients that
 * fade to transparent, which is already the soft-focus look — a real blur
 * would cost a full-screen compositing pass on Android for nothing visible.
 * Nothing here is interactive or announced.
 */
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useUi2Theme } from '../../../hooks/useUi2Theme';

/** Tall enough to cover the whole Home page at the largest Dynamic Type. */
const HEIGHT = 2200;

interface Blob {
  id: string;
  /** Palette key of the centre colour. */
  tone: 'primary' | 'yellow' | 'green';
  cx: number;
  cy: number;
  r: number;
  /** Centre opacity in light; dark needs more to read against near-black. */
  light: number;
  dark: number;
}

const BLOBS: readonly Blob[] = [
  { id: 'a', tone: 'primary', cx: 330, cy: 330, r: 210, light: 0.22, dark: 0.30 },
  { id: 'b', tone: 'yellow', cx: 20, cy: 670, r: 190, light: 0.20, dark: 0.22 },
  { id: 'c', tone: 'green', cx: 320, cy: 1260, r: 180, light: 0.18, dark: 0.22 },
  { id: 'd', tone: 'primary', cx: 40, cy: 1690, r: 190, light: 0.16, dark: 0.24 },
];

export function Atmosphere() {
  const { c, scheme } = useUi2Theme();
  const { width } = useWindowDimensions();
  return (
    <View
      pointerEvents="none"
      style={styles.layer}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={HEIGHT}>
        <Defs>
          {BLOBS.map((b) => (
            <RadialGradient key={b.id} id={`atmo-${b.id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c[b.tone]} stopOpacity={scheme === 'dark' ? b.dark : b.light} />
              <Stop offset="0.62" stopColor={c[b.tone]} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {BLOBS.map((b) => (
          // Positions are authored for a 390pt page; wider screens keep the
          // right-hand blobs pinned to the right edge rather than drifting in.
          <Circle key={b.id} cx={b.cx > 195 ? width - (390 - b.cx) : b.cx} cy={b.cy} r={b.r} fill={`url(#atmo-${b.id})`} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, top: 0, height: HEIGHT },
});
