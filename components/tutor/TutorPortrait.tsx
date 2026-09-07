/**
 * The tutor's face.
 *
 * ── THIS IS THE ARTWORK, NOT A STAND-IN FOR IT ──
 *
 * There is no `require()` here and there is not going to be one bolted on
 * later. `lib/tutor-personas.ts` keeps `portraitId` as a plain string for a
 * hard reason: a `require()` of a missing asset is a Metro BUNDLER failure, so
 * the first person to add `require('../../assets/tutor-mara.png')` before the
 * PNG exists takes down the whole app, not the tutor screen. This component is
 * the mapping layer that keeps that risk in one file.
 *
 * What it renders is a themed disc — the UI 2.0 slab material, `primary` over
 * `slab`, the same pair a SlabButton is made of — carrying the tutor's initial.
 * That is a deliberate, finished visual, not a grey box waiting for art. Four
 * tutors are told apart by name, initial and gradient orientation, all of which
 * are stable per tutor forever, which is the property rapport actually needs
 * (see the persona module's header: a tutor who looks different each session is
 * worse than no persona at all).
 *
 * If real portraits are ever commissioned, they land INSIDE this component —
 * an `<Image>` branch keyed on the same `portraitId`, with this disc staying as
 * the fallback for an asset that failed to load. Every call site keeps working
 * because none of them knows what a portrait is made of.
 *
 * ── WHY THE ORIENTATION VARIES AND THE COLOURS DO NOT ──
 *
 * The palette is settled; inventing a per-tutor hue would be inventing a
 * colour. So the deterministic per-tutor variation is spent on the gradient's
 * DIRECTION (four diagonals) and stop order (two), giving eight discs out of
 * exactly the two approved stops.
 *
 * UI 2.0 narrowed those stops. Dark Glow ran indigo→lilac, which was wide
 * enough that the direction was obvious at a glance; the only pair in the UI
 * 2.0 palette that carries white text at AA in BOTH schemes is `primary` over
 * `slab`, so that is the pair. The monogram stays readable at 32pt, which is
 * the constraint that has to win — the disc is not what identifies the tutor
 * anyway. The name is, and callers are required to render it (below).
 *
 * The stops are returned as TOKEN NAMES rather than colour strings so this
 * stays a pure function of the id: the same tutor resolves to the same two
 * tokens on every device, and the scheme decides what those tokens look like.
 *
 * ── DECORATIVE BY CONTRACT ──
 *
 * The disc is hidden from VoiceOver in every size. It carries no information a
 * sighted learner gets that a screen-reader user does not — the initial is a
 * lossy rendering of the name — so announcing it would only ever double up the
 * name that the caller renders beside it. Callers MUST render the tutor's name
 * as text somewhere adjacent; this component is not the accessible label for
 * the tutor and must not be treated as one.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { radii, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { initialsFor } from '../avatar/Avatar';

export type TutorPortraitSize = 'hero' | 'row' | 'inline';

/**
 * Disc diameters. `hero` is the call screen and the lobby; `row` is a list row
 * that still has to clear the 44pt touch minimum when it is inside something
 * pressable; `inline` sits next to a line of caption text.
 */
export const PORTRAIT_DIAMETER: Record<TutorPortraitSize, number> = {
  hero: 120,
  row: 56,
  inline: 32,
};

export interface PortraitGradient {
  /** A pair, not a list: `expo-linear-gradient` requires at least two stops at
   *  the type level, and this component only ever offers the two approved
   *  ones — a third would be a new colour. Palette KEYS, not colours: the
   *  scheme resolves them, so one disc definition serves light and dark. */
  tones: readonly [keyof Ui2Palette, keyof Ui2Palette];
  start: { x: number; y: number };
  end: { x: number; y: number };
}

/** The two approved stops, in their unreversed order. `primary` over `slab` is
 *  the slab material the whole design system is built from. */
const STOPS: readonly [keyof Ui2Palette, keyof Ui2Palette] = ['primary', 'slab'];

/**
 * Stable non-negative hash. djb2, mirrored from `lib/tutor-personas.ts` rather
 * than imported — that copy is private to the persona module and this one has
 * to work for ANY id string, including ids for personas that module has never
 * heard of. Collision resistance is irrelevant; a repeatable spread is the
 * entire requirement.
 */
function hash(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** The four diagonals, in the deck's 135deg family. */
const ORIENTATIONS: readonly { start: { x: number; y: number }; end: { x: number; y: number } }[] = [
  { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  { start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
  { start: { x: 0, y: 1 }, end: { x: 1, y: 0 } },
  { start: { x: 1, y: 1 }, end: { x: 0, y: 0 } },
];

/**
 * The disc's gradient for a given tutor. Pure and deterministic: the same id
 * produces the same disc on every device, on every launch, before anything has
 * been stored and after storage has been cleared — the same guarantee
 * `personaForLearner` makes about which tutor you get.
 */
export function portraitGradient(portraitId: string): PortraitGradient {
  const h = hash(portraitId);
  const orientation = ORIENTATIONS[h % ORIENTATIONS.length];
  // Second bit, not the same one that picked the orientation, so the two
  // choices are not locked together into four outcomes instead of eight.
  const reversed = ((h >>> 4) & 1) === 1;
  const tones: readonly [keyof Ui2Palette, keyof Ui2Palette] = reversed
    ? [STOPS[1], STOPS[0]]
    : [STOPS[0], STOPS[1]];
  return { tones, start: orientation.start, end: orientation.end };
}

/**
 * The single character on the disc.
 *
 * The name is the source of truth — it is what the learner is told the tutor is
 * called, so it is what the disc should agree with. `portraitId` is only
 * consulted when the name cannot produce a letter (empty, whitespace, emoji),
 * and the `tutor-` prefix is stripped first so `tutor-mara` yields `M` rather
 * than `T` — every id would otherwise collapse to the same initial, which is
 * the one outcome that defeats the point of having four of them.
 *
 * Built on `initialsFor` for its unicode handling (it is `\p{L}`-aware, so
 * non-Latin names keep their glyph instead of blanking) and then narrowed to
 * one grapheme: a portrait carries a monogram, not a pair of initials.
 */
export function tutorInitial(name: string, portraitId: string): string {
  const fromName = Array.from(initialsFor(name))[0] ?? '';
  if (fromName && fromName !== '·') return fromName;
  const idWithoutPrefix = portraitId.replace(/^tutor[-_]/i, '');
  return Array.from(initialsFor(idWithoutPrefix))[0] ?? '·';
}

interface TutorPortraitProps {
  portraitId: string;
  name: string;
  size?: TutorPortraitSize;
}

export function TutorPortrait({ portraitId, name, size = 'row' }: TutorPortraitProps) {
  const { c, type } = useUi2Theme();
  const diameter = PORTRAIT_DIAMETER[size];
  const gradient = useMemo(() => portraitGradient(portraitId), [portraitId]);
  const initial = useMemo(() => tutorInitial(name, portraitId), [name, portraitId]);

  return (
    <View
      // Decorative in every size — see the file header. The name always exists
      // as real text beside this, and announcing an initial as well would read
      // the tutor out twice.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.clip,
        { width: diameter, height: diameter, borderRadius: diameter / 2, borderColor: c.cardBorder },
      ]}
    >
      <LinearGradient
        colors={[c[gradient.tones[0]], c[gradient.tones[1]]]}
        start={gradient.start}
        end={gradient.end}
        style={styles.fill}
      >
        <Text
          style={[
            styles.initial,
            {
              // Scales with the disc so one component serves 32 through 120.
              fontSize: Math.round(diameter * 0.42),
              lineHeight: Math.round(diameter * 0.52),
              fontFamily: type.uiHeavy,
              // White on `primary` is 5.6:1 light / 4.6:1 dark and higher on
              // `slab`, so the monogram clears AA over the whole gradient.
              color: c.onPrimary,
            },
          ]}
        >
          {initial}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    // A hairline keeps the disc from bleeding into the card behind it at small
    // sizes, where the disc and the card are close in value in light mode.
    borderWidth: 1,
  },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  initial: {
    textAlign: 'center',
  },
});
