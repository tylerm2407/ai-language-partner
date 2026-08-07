/**
 * Theme tokens — single source of truth for the redesigned UI.
 * See redesign-plan.md for rationale; see design-research.md for empirical
 * citations behind each choice.
 *
 * Canonical palette is STUDIO GRAPHITE + INK & BRASS. Body text is validated
 * WCAG AAA (>=7:1) against surface.base (#0F0E0C). Primary FILLS are brass
 * (#C8A24A) carrying DARK text — text.onPrimary is near-black (7.9:1), not
 * white (white on brass is 2.4:1 and fails outright). See DESIGN.md §Primary.
 *
 * The graphite carries a deliberate warm bias (base is #0F0E0C, not a neutral
 * #0E0E10). A neutral near-black under a gold accent reads clinical; two points
 * of red/green bias in the surface is what keeps the theme professional without
 * being cold, and it costs nothing in contrast (base luminance is unchanged to
 * four decimal places).
 */

// ─── Colors ──────────────────────────────────────────────────────────────
export const colors = {
  /** Screen-level surfaces, from darkest to progressively lighter.
   *  Warm graphite. There is no ambient blob layer any more — depth comes from
   *  the surface steps and hairline borders, so `base` no longer has to be a
   *  near-void for a glow to read against it. */
  surface: {
    base: '#0F0E0C', // primary app background
    raised: '#151412', // reading / review / lesson content (+ contrast for focus)
    sunken: '#0A0908', // behind-content wells (scroll under, inset tracks)
    card: '#1B1A17',
    cardAlt: '#24221E',
    overlay: 'rgba(10, 9, 8, 0.84)', // modal backdrops / celebration scrim
    sheet: '#1B1A17', // bottom-sheet fill
  },

  /** Semantic action roles.
   *
   *  The indigo palette needed a fill/accent split because indigo.500 under
   *  white was 4.47:1. Brass inverts the problem: it is a LIGHT accent, so the
   *  fill carries dark text and the same hex works as both fill and accent.
   *  `accent` is the lifted step, used where a small glyph or 13px link needs
   *  more separation from the surface than the fill step gives. */
  action: {
    primaryFill: '#C8A24A', // brass.500 — text.onPrimary 7.9:1, on base 8.0:1
    /** @deprecated Slab CTAs are retired — see DESIGN.md §What We Retired.
     *  Retained only so pre-Studio call sites type-check; do not use. */
    primarySlab: '#8E6F2F', // brass.700
    primaryTint: 'rgba(200, 162, 74, 0.14)',
    accent: '#E0BE6B', // brass.300 — text links, small icons, progress (10.8:1)
  },

  /** Ambient wash. ONE top-anchored warm gradient, not the retired three-blob
   *  layer. Rendered by components/ui/GlowBackground.tsx. */
  glow: {
    brass: 'rgba(200, 162, 74, 1)', // the wash tint
    ember: 'rgba(226, 103, 60, 1)', // celebration-only second stop
  },

  /** Hairline borders. Warm-white alpha, so a 1px rule on a warm card does not
   *  read as a cool seam. */
  border: {
    subtle: 'rgba(245, 240, 230, 0.07)',
    default: 'rgba(245, 240, 230, 0.13)',
    strong: 'rgba(245, 240, 230, 0.24)',
    focus: '#C8A24A',
  },

  /** Text tokens — contrast ratios measured vs surface.base (#0F0E0C).
   *  Warm off-whites, not cool slate. #F1F5F9 over a warm graphite reads blue. */
  text: {
    primary: '#F2EFE9', // 16.9:1 (AAA)
    secondary: '#D6D1C7', // 12.7:1 (AAA)
    tertiary: '#9C968A', // 6.6:1 (AA)
    quaternary: '#7A756B', // 4.2:1 (large UI only — timestamps, placeholders)
    onPrimary: '#14120E', // DARK on brass fills (7.9:1). Never white — see header.
    onSuccess: '#0A1710', // dark text on success fill (5.9:1)
    onWarning: '#14120E', // dark text on warning fill (7.3:1)
    disabled: 'rgba(242, 239, 233, 0.38)',
  },

  /** Brass — primary brand. Steps are ordered by lightness like any Tailwind-
   *  shaped scale, so 300 is LIGHTER than 500. On a dark canvas the useful
   *  steps run 300–500; 600+ exist for pressed states and gradient stops. */
  brass: {
    50: '#FBF7EC',
    100: '#F4EBD3',
    200: '#E9D9AC',
    300: '#E0BE6B', // accent step — small text/icons on dark (10.8:1)
    400: '#D0B063', // 9.3:1
    500: '#C8A24A', // CANONICAL PRIMARY — fills, 8.0:1
    600: '#B08C3B',
    700: '#8E6F2F',
    800: '#6D5424',
    900: '#4C3A19',
  },

  /**
   * @deprecated Indigo is retired. These keys alias the brass scale by step so
   * pre-Studio call sites (`colors.indigo[400]`) keep compiling and pick up the
   * new palette instead of silently staying indigo. Migrate to `colors.brass`.
   */
  indigo: {
    50: '#FBF7EC',
    100: '#F4EBD3',
    200: '#E9D9AC',
    300: '#E0BE6B',
    400: '#D0B063',
    500: '#C8A24A',
    600: '#C8A24A',
    700: '#8E6F2F',
    800: '#6D5424',
    900: '#4C3A19',
  },

  /** Semantic.
   *
   *  Every base below is desaturated relative to the old Tailwind-bright set.
   *  A #22C55E green and a #EF4444 red next to a gold accent is a traffic light;
   *  muted jade and clay keep the semantics legible without shouting over the
   *  brand color. `.light` steps are what small text uses — the bases sit at or
   *  under AA at 13px, exactly as they did before. */
  success: {
    base: '#4E9F6B', // 6.0:1 — fills and icons
    dark: '#3C7E54',
    light: '#7FC79A', // 9.7:1 — chip labels, inline diffs
    tint: 'rgba(78, 159, 107, 0.15)',
    border: 'rgba(78, 159, 107, 0.35)',
  },
  error: {
    base: '#C0555F', // 4.3:1 — fills and icons only
    dark: '#9E434C',
    light: '#E39098', // 8.2:1 — chip labels, inline diffs
    tint: 'rgba(192, 85, 95, 0.15)',
    border: 'rgba(192, 85, 95, 0.40)',
  },
  warning: {
    base: '#D9913C', // 7.4:1
    dark: '#B4762D',
    light: '#EFBB7C',
    tint: 'rgba(217, 145, 60, 0.15)',
    border: 'rgba(217, 145, 60, 0.35)',
  },
  streak: {
    base: '#E2673C', // ember — 5.8:1
    fire: '#F0763D',
    /** Ember-orange, deliberately hotter than `warning` and well clear of the
     *  brass accent. Three warm tokens now share a canvas — brass (43°),
     *  warning (33°), streak (20°) — so the icon+label rule in DESIGN.md
     *  §Accessibility is load-bearing here, not decorative. */
    tint: 'rgba(226, 103, 60, 0.15)',
    light: '#F2A886', // streak chip label on dark
  },
  premium: {
    /** Premium is the brand's own accent at its brightest, not a separate hue.
     *  A purple next to brass reads as a second brand; the most valuable tier
     *  should look like the most concentrated version of the brand color. */
    base: '#E0BE6B',
    tint: 'rgba(224, 190, 107, 0.16)',
  },

  /** League tier colors — retuned as metals that live in the graphite world.
   *  The old #FFD700 gold sat brighter than every CTA on screen. */
  league: {
    bronze: '#9C6B3F',
    silver: '#A8AAAE',
    gold: '#D2A840',
    platinum: '#C3C9D2',
    diamond: '#86B4CE',
  },

  /** Heart colors (gamification) */
  heart: {
    filled: '#C0555F',
    empty: '#55524B',
  },

  /** Magazine / editorial palette */
  magazine: {
    nebulaTop: '#0F0E0C',
    nebulaMid: '#1B1A17',
    accentBlue: '#D0B063', // active-tab gradient start
    accentViolet: '#B08C3B', // active-tab gradient end
    accentLilac: '#E0BE6B', // kickers, premium accents
    heartsCoral: '#C0555F',
    xpGold: '#D0B063',
    streakFlame: '#E2673C',
    // Opaque under Studio Graphite — the editorial voice is carried by type
    // (Fraunces + mono), not by a differently-tinted card.
    glassBg: '#1B1A17',
    glassBorder: 'rgba(245, 240, 230, 0.13)',
  },

  /** Correction-banner error-type chip styles. Hues stay distinguishable (they
   *  encode error TYPE) but are desaturated into the warm-graphite world; the
   *  old set was six saturated Tailwind tints on one banner. */
  correctionChip: {
    grammar: { bg: 'rgba(125, 166, 199, 0.20)', text: '#A8C6DC' },
    vocabulary: { bg: 'rgba(178, 150, 190, 0.20)', text: '#C9B3D4' },
    spelling: { bg: 'rgba(200, 196, 186, 0.18)', text: '#CFCABF' },
    word_order: { bg: 'rgba(226, 140, 80, 0.20)', text: '#E8A97E' },
    tense: { bg: 'rgba(110, 180, 140, 0.20)', text: '#9BD4B4' },
    gender: { bg: 'rgba(210, 130, 150, 0.20)', text: '#E0A5B6' },
    other: { bg: 'rgba(200, 196, 186, 0.18)', text: '#CFCABF' },
  },
} as const;

// ─── Spacing (4-8pt grid) ────────────────────────────────────────────────
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// ─── Radii ───────────────────────────────────────────────────────────────
export const radii = {
  sm: 8, // small pills, badges
  md: 12, // inputs
  lg: 14, // standard card + buttons
  xl: 16, // large cards
  xxl: 20, // exercise cards, hero cards
  pill: 999,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────

/**
 * Natural line box of each face, in em, read from the font binaries.
 *
 * A `lineHeight` below these numbers does not compress the text — both
 * platforms pin the baseline and clip the ascender, so the TOP of the glyphs
 * disappears. Use `minLineHeight()` for any fontSize not already in the scale.
 *
 * Read from the font binaries as `ascender - descender + lineGap` over
 * `head.unitsPerEm`. All three faces set OS/2 `fsSelection` bit 7
 * (USE_TYPO_METRICS), so the platform lays out against the typo metrics — which
 * here equal hhea — and NOT the larger usWin* pair:
 *
 *   face            typo/hhea   usWin*   capHeight
 *   Nunito            1.364     1.377      0.705
 *   Fraunces          1.233     1.474      0.700
 *   JetBrains Mono    1.320     1.320        —
 *
 * These replaced Inter's ~1.21em. The scale's old lineHeights were Inter's and
 * clipped every heading by 1-5px after the font swap.
 */
export const leading = {
  /** Nunito — body, headings, CTA labels. */
  sans: 1.364,
  /** Fraunces — display face. Tighter than Nunito despite being larger on screen. */
  display: 1.233,
  /** JetBrains Mono — meta rows, eyebrows. */
  mono: 1.32,
} as const;

/**
 * Smallest lineHeight that will not clip `face` at `fontSize`.
 *
 * This is the whole-font bound (ascender to descender). Text that renders only
 * capitals or digits has ~0.3em of unused headroom and can safely sit tighter —
 * but only assume that where the content is provably numeric.
 */
export function minLineHeight(fontSize: number, face: keyof typeof leading = 'sans'): number {
  return Math.ceil(fontSize * leading[face]);
}

export const typography = {
  family: {
    regular: 'Nunito_400Regular',
    medium: 'Nunito_500Medium',
    semibold: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
    extrabold: 'Nunito_800ExtraBold', // headings, CTA labels
    display: 'Fraunces_700Bold', // celebration / hero only
    serif: 'Fraunces_600SemiBold', // magazine editorial headlines
    mono: 'JetBrainsMono_400Regular',
    monoMedium: 'JetBrainsMono_500Medium',
  },
  /** Every scale step carries its own weight. Applying fontSize without the
   *  matching lineHeight + weight drops two thirds of the token — see
   *  components/ui/Text.tsx, which always emits all three together.
   *
   *  Every lineHeight below is >= minLineHeight(fontSize, face). Going under it
   *  clips the ascender — config/theme.test.ts enforces this. */
  scale: {
    // Title / Display — hero renders in the display face (Fraunces)
    hero: { fontSize: 32, lineHeight: 40, weight: 'extrabold' as const },
    h1: { fontSize: 28, lineHeight: 39, weight: 'extrabold' as const },
    h2: { fontSize: 24, lineHeight: 33, weight: 'extrabold' as const },
    h3: { fontSize: 22, lineHeight: 31, weight: 'bold' as const },
    // Body
    bodyLg: { fontSize: 17, lineHeight: 25, weight: 'bold' as const },
    body: { fontSize: 16, lineHeight: 24, weight: 'medium' as const },
    bodySm: { fontSize: 14, lineHeight: 20, weight: 'medium' as const },
    // Meta
    caption: { fontSize: 13, lineHeight: 18, weight: 'semibold' as const },
    tiny: { fontSize: 12, lineHeight: 17, weight: 'semibold' as const },
  },
  /** Editorial letter-spacing. Mono eyebrows/labels are tracked wide; display
   *  headings tighten. Values are the deck's, verbatim. */
  tracking: {
    dateLabel: 3, // DateLabel mono 12px
    eyebrow: 1.5, // mono meta rows (`3 MIN READ · READ →`)
    kicker: 2, // serif kicker (`TODAY'S READ · NIVEL A2`)
    banner: 1, // uppercase section banners
    cta: 0.9, // uppercase TactileButton labels
    chip: 0.4, // Chip label
    heading: -0.6, // h1/h2 optical tightening
  },
} as const;

// ─── Motion ──────────────────────────────────────────────────────────────
export const motion = {
  duration: {
    instant: 100, // tap feedback
    micro: 150, // icon swap
    short: 200, // default component transition
    medium: 300, // sheets, cards
    long: 450, // full-screen transitions
    celebration: 600, // reward moments
  },
  /** react-native-reanimated Easing bezier coefficients */
  easing: {
    standard: [0.2, 0.0, 0.0, 1.0] as const,
    decelerate: [0.0, 0.0, 0.0, 1.0] as const, // ease-out
    accelerate: [0.4, 0.0, 1.0, 1.0] as const, // ease-in
    emphasized: [0.2, 0.0, 0.0, 1.0] as const,
    backOut: [0.175, 0.885, 0.32, 1.275] as const, // celebration pop
  },
} as const;

// ─── Shadow / elevation ──────────────────────────────────────────────────
/** Flat by default. Shadows are permitted only for modals/sheets. */
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  /** @deprecated The slab CTA is retired — Studio CTAs are flat and press with
   *  a 0.96 scale. Retained so pre-Studio call sites type-check. */
  tactile: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  /** For bottom sheets and modals. */
  overlay: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
} as const;

// ─── Haptics map ──────────────────────────────────────────────────────────
/** Named intents → expo-haptics calls (resolved at call sites). */
export const haptics = {
  tap: 'selection', // Haptics.selectionAsync()
  correct: 'success', // Haptics.notificationAsync(Success)
  incorrect: 'error', // Haptics.notificationAsync(Error)
  buttonPress: 'light', // Haptics.impactAsync(Light)
  milestone: 'heavy', // Haptics.impactAsync(Heavy)
} as const;

export const theme = { colors, spacing, radii, typography, motion, elevation, haptics };
export type Theme = typeof theme;
