/**
 * Small pieces the onboarding step components share: the mascot's mood hook, the two
 * row leads (signal bars, flag tile), the step frame contract, and the style
 * sheet every step draws from.
 */
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type Animated from 'react-native-reanimated';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import type { CefrBand } from '../../../lib/cefr-proficiency';
import { cefrChipVariant } from '../../ui2/CefrExplainerSheet';
import type { MascotMood } from '../../ui2/Ui2Mascot';
import type { StepHeroEntrance } from '../../ui2/StepHero';

/**
 * What the screen hands every form step: the hero block (back, "Step n of 6",
 * the question, the mascot) and the staggered entrance for the rows beneath it. Both
 * depend on screen-level state — step index, back target, reduce-motion — that
 * the steps themselves have no business knowing.
 */
export interface StepFrame {
  hero: (text: string, entrance: StepHeroEntrance, mood?: MascotMood) => ReactNode;
  enter: (i: number) => ComponentProps<typeof Animated.View>['entering'];
  /** One-shot cheer from the mascot on a good tap. */
  cheer: () => void;
}

/** The mascot's mood: a base mood per step, with a one-shot cheer on a good tap. */
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

/**
 * The band code as the row's lead. Green, amber, pink up the ladder — the same
 * three tints the explainer sheet's ladder uses, so the two read as one scale.
 * On the selected (solid primary) row the tile goes to the slab shade with
 * white text, the way the flag tile swaps on a selected language.
 */
export function BandTile({ band, selected }: { band: CefrBand; selected: boolean }) {
  const { c, type } = useUi2Theme();
  const variant = cefrChipVariant(band);
  const fill = selected
    ? { bg: c.slab, fg: c.onPrimary }
    : variant === 'success'
      ? { bg: c.greenTint, fg: c.green }
      : variant === 'warning'
        ? { bg: c.yellowTint, fg: c.yellow }
        : { bg: c.pinkTint, fg: c.error };
  return (
    <View style={[stepStyles.bandTile, { backgroundColor: fill.bg }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={{ fontFamily: type.uiHeavy, fontSize: 14, color: fill.fg }}>{band}</Text>
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
  flagTile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bandTile: { width: 44, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cefrNote: { gap: 2, padding: 14, borderRadius: 16 },
  canDo: { padding: 10, borderRadius: 14 },
  flagGlyph: { fontSize: 18 },
});
