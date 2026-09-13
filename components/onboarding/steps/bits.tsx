/**
 * Small pieces the onboarding step components share: Sol's mood hook, the two
 * row leads (signal bars, flag tile), the step frame contract, and the style
 * sheet every step draws from.
 */
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type Animated from 'react-native-reanimated';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import type { MascotMood } from '../../ui2/MascotSol';
import type { StepHeroEntrance } from '../../ui2/StepHero';

/**
 * What the screen hands every form step: the hero block (back, "Step n of 6",
 * the question, Sol) and the staggered entrance for the rows beneath it. Both
 * depend on screen-level state — step index, back target, reduce-motion — that
 * the steps themselves have no business knowing.
 */
export interface StepFrame {
  hero: (text: string, entrance: StepHeroEntrance, mood?: MascotMood) => ReactNode;
  enter: (i: number) => ComponentProps<typeof Animated.View>['entering'];
  /** One-shot cheer from Sol on a good tap. */
  cheer: () => void;
}

/** Sol's mood: a base mood per step, with a one-shot cheer on a good tap. */
export function useMascotMood(base: MascotMood): [MascotMood, () => void] {
  const [cheering, setCheering] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cheer = useCallback(() => {
    setCheering(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCheering(false), 700);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return [cheering ? 'cheer' : base, cheer];
}

export function LevelBars({ lit, selected }: { lit: number; selected: boolean }) {
  const { c } = useUi2Theme();
  // On the selected row the block is solid primary, so the lit bars go white.
  const on = selected ? c.onPrimary : c.primary;
  const off = selected ? c.onPrimary : c.idle;
  return (
    <View style={stepStyles.bars} accessibilityElementsHidden importantForAccessibility="no">
      {[0, 1, 2, 3, 4].map((k) => (
        <View
          key={k}
          style={[stepStyles.bar, { height: 6 + k * 4, backgroundColor: k < lit ? on : off, opacity: k < lit ? 1 : 0.4 }]}
        />
      ))}
    </View>
  );
}

export function FlagTile({ flag, selected }: { flag: string; selected: boolean }) {
  const { c } = useUi2Theme();
  // On the selected tile the block is solid primary; the flag sits on white.
  return (
    <View
      style={[stepStyles.flagTile, { backgroundColor: selected ? c.onPrimary : c.primaryTint }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={stepStyles.flagGlyph}>{flag}</Text>
    </View>
  );
}

export const stepStyles = StyleSheet.create({
  rows: { gap: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inputCard: { gap: 10 },
  multiline: { fontSize: 16, lineHeight: 24, minHeight: 110, textAlignVertical: 'top', padding: 0 },
  singleLine: { fontSize: 16, lineHeight: 22, padding: 0, minHeight: 28 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  solCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 22 },
  bar: { width: 5, borderRadius: 2 },
  flagTile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flagGlyph: { fontSize: 18 },
});
