/**
 * Theme tokens — single source of truth for the redesigned UI.
 * See redesign-plan.md for rationale; see design-research.md for empirical
 * citations behind each choice.
 *
 * Canonical palette is MONOCHROME: black, charcoal, silver, grey. Body text is
 * validated WCAG AAA (>=7:1) against surface.base (#08090A).
 *
 * The load-bearing idea: in a monochrome system the CTA is the BRIGHTEST thing
 * on the screen. `action.primaryFill` is near-white (#F2F4F6) carrying a
 * near-black label at 18.1:1 — a harder pop than any colored fill can reach,
 * which is what stops greyscale from reading as drab. Everything else is a step
 * on the silver ramp, and hierarchy comes from lightness, not hue.
 *
 * Exactly TWO hues survive, and only where they do functional work:
 * `success` (correct) and `error` (incorrect, hearts). Streak, warning,
 * premium, league tiers, achievement and mistake categories are all greyscale —
 * they are distinguished by icon and label, per §Core Principles rule 6.
 */

// ─── Colors ──────────────────────────────────────────────────────────────
export const colors = {
  /** Screen-level surfaces, from darkest to progressively lighter.
   *  Neutral charcoal with a very slight cool cast. The steps are wider than
   *  the previous palette's on purpose — crispness in monochrome comes from
   *  clearly separated surfaces plus visible hairlines, not from tint. */
  surface: {
    base: '#08090A', // primary app background
    raised: '#0E0F11', // reading / review / lesson content (+ contrast for focus)
    sunken: '#050506', // behind-content wells (scroll under, inset tracks)
    card: '#141618',
    cardAlt: '#1C1F22',
    overlay: 'rgba(5, 5, 6, 0.86)', // modal backdrops / celebration scrim
    sheet: '#141618', // bottom-sheet fill
  },

  /** Semantic action roles.
   *
   *  Brass was a light fill too, but at 8:1 it had to compete with the warm
   *  surfaces around it. Near-white on near-black has nothing to compete with:
   *  the CTA is simply the highest-contrast element in the composition. */
  action: {
    primaryFill: '#F2F4F6', // silver.100 — text.onPrimary 18.1:1, on base 18.1:1
    /** @deprecated Slab CTAs are retired — see DESIGN.md §What We Retired.
     *  Retained only so pre-Studio call sites type-check; do not use. */
    primarySlab: '#ADB3BA', // silver.400
    primaryTint: 'rgba(242, 244, 246, 0.10)',
    accent: '#C9CDD2', // silver.300 — text links, small icons, spinners (12.5:1)
  },

  /** Ambient light. ONE top-anchored silver wash per screen, plus optional
   *  `StatBloom` halos behind key numerals. Rendered by
   *  components/ui/GlowBackground.tsx. */
  glow: {
    silver: 'rgba(226, 230, 234, 1)', // the wash + bloom tint
    bloom: 'rgba(242, 244, 246, 1)', // brighter core for stat halos
  },

  /** Hairline borders. Neutral white alpha, stepped up from the previous
   *  palette — on pure charcoal a 0.07 hairline disappears, and the crisp
   *  look depends on the edges actually being visible. */
  border: {
    subtle: 'rgba(255, 255, 255, 0.08)',
    default: 'rgba(255, 255, 255, 0.15)',
    strong: 'rgba(255, 255, 255, 0.28)',
    focus: '#F2F4F6',
  },

  /** Text tokens — contrast ratios measured vs surface.base (#08090A).
   *  Neutral greys. `primary` stops short of pure #FFFFFF: full white on a
   *  near-black field haloes on OLED (§Core Principles rule 5). */
  text: {
    primary: '#F7F8F9', // 18.7:1 (AAA)
    secondary: '#B4B9BF', // 10.1:1 (AAA)
    tertiary: '#80868C', // 5.4:1 (AA)
    quaternary: '#5C6166', // 3.2:1 (large UI only — timestamps, placeholders)
    onPrimary: '#08090A', // DARK on the near-white CTA fill (18.1:1)
    onSuccess: '#052B10', // dark text on success fill (6.1:1)
    onWarning: '#08090A', // warning is greyscale now — dark label on it
    disabled: 'rgba(247, 248, 249, 0.38)',
  },

  /** Silver — the brand ramp. Ordered by lightness like any Tailwind-shaped
   *  scale, so 100 is the near-white CTA step and 900 is nearly a surface.
   *  On a charcoal canvas the useful text/icon steps run 100–400; 600+ are
   *  tracks, dividers, disabled states and gradient stops. */
  silver: {
    50: '#FFFFFF',
    100: '#F2F4F6', // CTA fill (18.1:1)
    200: '#E2E6EA', // 15.5:1 — streak, emphasis numerals
    300: '#C9CDD2', // accent step — links, icons (12.5:1)
    400: '#ADB3BA', // 9.4:1
    500: '#8C9198', // 6.3:1
    600: '#6B7076', // 4.0:1 — large UI only
    700: '#4E5257', // 2.5:1 — disabled glyphs, empty states
    800: '#33373B', // 1.7:1 — tracks, dividers
    900: '#1C1F22', // = surface.cardAlt
  },

  /**
   * @deprecated Brass is retired. These keys alias the silver ramp by step so
   * pre-monochrome call sites (`colors.brass[300]`) keep compiling and pick up
   * the new palette instead of silently staying gold. Migrate to
   * `colors.silver`. Note the ordering flips meaning: brass ran dark-to-light
   * the same way, so a step-for-step alias is correct.
   */
  brass: {
    50: '#FFFFFF',
    100: '#F2F4F6',
    200: '#E2E6EA',
    300: '#C9CDD2',
    400: '#ADB3BA',
    500: '#F2F4F6', // was the CTA fill — must stay the CTA fill
    600: '#ADB3BA',
    700: '#8C9198',
    800: '#4E5257',
    900: '#33373B',
  },

  /** @deprecated Two palettes ago. Aliases onto silver via `brass`. */
  indigo: {
    50: '#FFFFFF',
    100: '#F2F4F6',
    200: '#E2E6EA',
    300: '#C9CDD2',
    400: '#C9CDD2',
    500: '#F2F4F6',
    600: '#F2F4F6',
    700: '#8C9198',
    800: '#4E5257',
    900: '#33373B',
  },

  /** Semantic.
   *
   *  ONLY `success` and `error` carry hue, and only because grading feedback
   *  is the one place in a learning app where a colour cue is doing real work.
   *  Both are the GitHub dark-UI pair — engineered for exactly this job:
   *  legible on near-black, distinguishable under the common colour-vision
   *  deficiencies, and unsaturated enough not to fight a greyscale system.
   *
   *  `.light` steps are what small text uses; the bases are for fills and
   *  icons. The `danger` CTA fill is `error.dark`, which clears 5.0:1 under a
   *  white label where `error.base` would not. */
  success: {
    base: '#3FB950', // 7.9:1
    dark: '#2EA043',
    light: '#56D364', // 10.3:1 — chip labels, inline diffs
    tint: 'rgba(63, 185, 80, 0.14)',
    border: 'rgba(63, 185, 80, 0.32)',
  },
  error: {
    base: '#F85149', // 5.9:1
    dark: '#C93C34', // danger CTA fill — white label 5.0:1
    light: '#FF7B72', // 7.9:1 — chip labels, inline diffs
    tint: 'rgba(248, 81, 73, 0.14)',
    border: 'rgba(248, 81, 73, 0.34)',
  },
  /** Greyscale. A third hue would break the two-signal rule, and a warning is
   *  always accompanied by an icon and a label that say so. */
  warning: {
    base: '#E2E6EA',
    dark: '#ADB3BA',
    light: '#F2F4F6',
    tint: 'rgba(226, 230, 234, 0.12)',
    border: 'rgba(226, 230, 234, 0.30)',
  },
  /** Greyscale — the flame glyph carries the meaning. A warm streak colour was
   *  the single largest source of stray hue in the previous palette. */
  streak: {
    base: '#E2E6EA',
    fire: '#F2F4F6',
    tint: 'rgba(226, 230, 234, 0.12)',
    light: '#F7F8F9',
  },
  /** Premium is pure white — in a monochrome system the brightest possible
   *  value IS the most valuable one. */
  premium: {
    base: '#FFFFFF',
    tint: 'rgba(255, 255, 255, 0.12)',
  },

  /** League tiers. Rank maps to BRIGHTNESS, not to metal colour — bronze is the
   *  dimmest step and diamond the brightest, so the ladder is legible at a
   *  glance without five competing hues. */
  league: {
    bronze: '#6B7076',
    silver: '#8C9198',
    gold: '#ADB3BA',
    platinum: '#C9CDD2',
    diamond: '#F2F4F6',
  },

  /** Hearts keep red: they are a depletable resource and the loss signal is
   *  the one place the app wants an involuntary reaction. */
  heart: {
    filled: '#F85149',
    empty: '#4E5257',
  },

  /** Magazine / editorial palette. All greyscale — the editorial voice is
   *  carried by type (Fraunces + mono), never by tint. */
  magazine: {
    nebulaTop: '#08090A',
    nebulaMid: '#141618',
    accentBlue: '#C9CDD2', // active-tab gradient start
    accentViolet: '#8C9198', // active-tab gradient end
    accentLilac: '#E2E6EA', // kickers, premium accents
    heartsCoral: '#F85149',
    xpGold: '#E2E6EA',
    streakFlame: '#F2F4F6',
    glassBg: '#141618',
    glassBorder: 'rgba(255, 255, 255, 0.15)',
  },

  /** Correction-banner error-type chip styles.
   *
   *  Deliberately IDENTICAL across all seven types. The chip already prints the
   *  error type as text ("GRAMMAR", "WORD ORDER"), so hue was encoding nothing
   *  the label did not already say — it was seven decorative tints on a single
   *  banner. Severity is carried by the banner border, per DESIGN.md §Chat. */
  correctionChip: {
    grammar: { bg: 'rgba(255, 255, 255, 0.07)', text: '#C9CDD2' },
    vocabulary: { bg: 'rgba(255, 255, 255, 0.07)', text: '#C9CDD2' },
    spelling: { bg: 'rgba(255, 255, 255, 0.07)', text: '#C9CDD2' },
    word_order: { bg: 'rgba(255, 255, 255, 0.07)', text: '#C9CDD2' },
    tense: { bg: 'rgba(255, 255, 255, 0.07)', text: '#C9CDD2' },
    gender: { bg: 'rgba(255, 255, 255, 0.07)', text: '#C9CDD2' },
    other: { bg: 'rgba(255, 255, 255, 0.07)', text: '#C9CDD2' },
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
  /** @deprecated The slab CTA is retired — CTAs are flat and press with a 0.96
   *  scale. Retained so pre-Studio call sites type-check. */
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
