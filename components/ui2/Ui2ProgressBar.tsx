/**
 * Ui2ProgressBar — the UI 2.0 counterpart to `components/ui/ProgressBar.tsx`.
 *
 * Same two props ({ progress, height }) and the same 0–1 contract, so a screen
 * swaps the import and nothing else.
 *
 * WHAT CHANGED AND WHY
 *
 * The old bar painted itself with `GRADIENT_COLORS` and a hardcoded `#818CF8`
 * glow shadow. Both are Dark Glow artefacts: on a white ground the indigo glow
 * is invisible and the gradient reads as a smudge. UI 2.0 fills with a flat
 * `c.primary` on a `c.track` groove, which is the pair DESIGN.md names for
 * filled/unfilled progress and the same pair `StepHeader` already uses.
 *
 * The spring moved from RN `Animated` to Reanimated so the width interpolation
 * runs on the UI thread — the old one passed `useNativeDriver: false` because
 * width is not natively animatable, which meant every frame of every progress
 * bar crossed the bridge. It is also now gated on `useMotion().shouldReduce`:
 * a bar that snaps is still perfectly legible, and DESIGN.md requires every
 * motion in UI 2.0 to have that gate.
 */
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface Ui2ProgressBarProps {
  /** 0 to 1. Values outside the range are clamped, never thrown. */
  progress: number;
  height?: number;
  /** Screen-reader name. Without one the bar announces only its percentage. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Clamp to 0–1, and treat a non-finite input as 0.
 *
 * The old bar clamped with bare `Math.min/Math.max`, which passes `NaN`
 * straight through — and `NaN` reaches this component the ordinary way, as
 * `done / total` with `total` still 0 on the first render before counts load.
 * A `NaN` width silently collapses the fill to nothing on RN and crashes the
 * percentage string on web, so it is worth one extra check here.
 */
export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(Math.max(progress, 0), 1);
}

const PROGRESS_SPRING = { damping: 18, stiffness: 140 };

export function Ui2ProgressBar({ progress, height = 8, accessibilityLabel, style }: Ui2ProgressBarProps) {
  const { c } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const clamped = clampProgress(progress);
  const width = useSharedValue(clamped);

  useEffect(() => {
    width.value = shouldReduce ? clamped : withSpring(clamped, PROGRESS_SPRING);
  }, [clamped, shouldReduce, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View
      style={[styles.track, { backgroundColor: c.track, height, borderRadius: height / 2 }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View
        style={[styles.fill, { backgroundColor: c.primary, borderRadius: height / 2 }, fill]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
