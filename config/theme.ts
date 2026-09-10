/**
 * Theme tokens — single source of truth for the redesigned UI.
 * See redesign-plan.md for rationale; see design-research.md for empirical
 * citations behind each choice.
 *
 * Canonical palette is DARK GLOW. Body text is validated WCAG AAA (≥7:1)
 * against surface.base (#08090F). Primary FILLS are Indigo 600 (#4F46E5 —
 * white 6.4:1, clears AA) with the brighter #818CF8 (indigo.400) reserved for
 * text/icon accents on dark. See DESIGN.md §Primary.
 */

// ─── Colors ──────────────────────────────────────────────────────────────
export const colors = {
  /** Screen-level surfaces, from darkest to progressively lighter.
   *  base/raised/sunken are deepened for the glow direction — the blob layer
   *  reads as depth against a near-black void. Cards are unchanged so content
   *  contrast is untouched. */
  surface: {
    base: '#08090F', // primary app background (glow layer paints over this)
    raised: '#0E1119', // reading / review / lesson content (+ contrast for focus)
    sunken: '#060710', // behind-content wells (scroll under, inset tracks)
    card: '#151921',
    cardAlt: '#1C212B',
    overlay: 'rgba(6, 8, 12, 0.82)', // modal backdrops / celebration scrim
    sheet: '#1A1F29', // bottom-sheet fill
    /** Unfilled segment of a discrete progress track — the lesson runner's
     *  per-exercise ticks. One step above cardAlt so an empty tick still
     *  reads as a countable segment against the raised lesson surface,
     *  which cardAlt does not at 5px tall. */
    track: '#242A36',
  },

  /** Semantic action roles. Fills must clear AA against text.onPrimary, which
   *  indigo.500 does NOT (4.47:1) — every CTA fill goes through these. */
  action: {
    primaryFill: '#4F46E5', // indigo.600 — white 6.4:1
    primarySlab: '#3730A3', // indigo.800 — tactile slab drops one step with the fill
    primaryTint: 'rgba(99, 102, 241, 0.15)',
    /** Border that pairs with primaryTint on a selected/active surface —
     *  indigo.500 at 0.55. Full-strength indigo.500 reads as a CTA outline and
     *  competes with the actual CTA sitting inside the row. */
    primaryBorder: 'rgba(99, 102, 241, 0.55)',
    accent: '#818CF8', // indigo.400 — text links, small icons, progress glow (6.43:1)
  },

  /** Ambient glow layer — three blurred radial blobs between the base fill
   *  (z0) and content (z5). Rendered by components/ui/GlowBackground.tsx. */
  glow: {
    indigo: 'rgba(99, 102, 241, 1)', // indigo.500
    violet: 'rgba(124, 58, 237, 1)', // magazine.accentViolet
    lilacIndigo: 'rgba(129, 140, 248, 1)', // indigo.400
  },

  /** Hairline borders on dark */
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.12)',
    strong: 'rgba(255, 255, 255, 0.24)',
    focus: '#6366F1',
  },

  /** Text tokens — contrast ratios measured vs surface.base */
  text: {
    primary: '#F1F5F9', // 15.6:1 (AAA)
    secondary: '#CBD5E1', // 10.9:1 (AAA)
    tertiary: '#94A3B8', // 6.2:1 (AA)
    quaternary: '#64748B', // 3.9:1 (large UI only — timestamps, placeholders)
    onPrimary: '#FFFFFF', // text on action.primaryFill (6.4:1)
    onSuccess: '#052E1A', // dark text on bright success (7.1:1)
    onWarning: '#0C0F14', // dark text on bright warning (9.0:1)
    disabled: 'rgba(241, 245, 249, 0.38)',
  },

  /** Indigo — primary brand */
  indigo: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8', // brighter primary for accents on dark
    500: '#6366F1', // CANONICAL PRIMARY
    600: '#4F46E5',
    700: '#4338CA', // button bottom-slab edge
    800: '#3730A3',
    900: '#312E81',
  },

  /** Semantic */
  success: {
    base: '#22C55E',
    dark: '#16A34A',
    light: '#6EE7B7',
    tint: 'rgba(34, 197, 94, 0.15)',
    border: 'rgba(34, 197, 94, 0.35)',
  },
  error: {
    base: '#EF4444',
    dark: '#DC2626',
    light: '#FCA5A5',
    tint: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.40)',
  },
  warning: {
    base: '#F59E0B',
    dark: '#D97706',
    light: '#FCD34D',
    tint: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.35)',
  },
  flame: {
    base: '#F59E0B',
    fire: '#F97316',
    /** Orange-based so a flame accent never reads as a warning chip — the two
     *  sat side by side on Home in identical amber. */
    tint: 'rgba(249, 115, 22, 0.15)',
    light: '#FDBA74', // flame label on dark
  },
  premium: {
    base: '#A855F7',
    tint: 'rgba(168, 85, 247, 0.18)',
    /** Outline for premium/milestone surfaces — matches the semantic tokens'
     *  border step so a violet-outlined row sits at the same weight as a
     *  success- or warning-outlined one. */
    border: 'rgba(168, 85, 247, 0.42)',
  },

  /** League tier colors (kept from existing DESIGN.md) */
  league: {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#A78BFA',
    diamond: '#38BDF8',
  },

  /** Magazine / editorial palette */
  magazine: {
    nebulaTop: '#0a0520',
    nebulaMid: '#1a0a3e',
    accentBlue: '#4F8EF7',
    accentViolet: '#7C3AED',
    accentLilac: '#A855F7',
    xpGold: '#FFB547',
    flame: '#FF8A3D',
    // Opaque under Dark Glow — the editorial voice is carried by type
    // (Fraunces + mono), not by a differently-tinted card.
    glassBg: '#151921',
    glassBorder: 'rgba(255,255,255,0.12)',
  },

  /** Correction-banner error-type chip styles */
  correctionChip: {
    grammar: { bg: 'rgba(56, 189, 248, 0.22)', text: '#7DD3FC' },
    vocabulary: { bg: 'rgba(168, 85, 247, 0.22)', text: '#C084FC' },
    spelling: { bg: 'rgba(148, 163, 184, 0.22)', text: '#CBD5E1' },
    word_order: { bg: 'rgba(251, 146, 60, 0.22)', text: '#FB923C' },
    tense: { bg: 'rgba(52, 211, 153, 0.22)', text: '#6EE7B7' },
    gender: { bg: 'rgba(244, 114, 182, 0.22)', text: '#F472B6' },
    other: { bg: 'rgba(148, 163, 184, 0.22)', text: '#CBD5E1' },
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
 *   Manrope           1.366     1.366      0.720
 *   Fraunces          1.233     1.474      0.700
 *   JetBrains Mono    1.320     1.320        —
 *
 * These replaced Inter's ~1.21em. The scale's old lineHeights were Inter's and
 * clipped every heading by 1-5px after the font swap.
 */
export const leading = {
  /** Manrope — body, headings, CTA labels (replaced Nunito 2026-09-07; same box). */
  sans: 1.366,
  /** Fraunces — display face. Tighter than Manrope despite being larger on screen. */
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
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    extrabold: 'Manrope_800ExtraBold', // headings, CTA labels
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
/** Flat by default. Shadows only permitted for tactile button slab + modals. */
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  /** For raised tactile buttons (slab edge). Shadow is visual slab, not drop. */
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

// ─── Haptics ──────────────────────────────────────────────────────────────
// Haptics live in lib/haptics.ts, not here.
//
// This file used to carry a `haptics` map of intent names to strings like
// 'selection' and 'heavy', described as "resolved at call sites". Nothing ever
// read it — every call site imported expo-haptics and picked its own call — so
// it documented an intention rather than a behaviour, and drifted from what the
// app actually did. The real table is EFFECTS in lib/haptics.ts, where naming
// an intent also produces it.
//
// It is deliberately not part of `theme`: a theme is what the interface looks
// like, and a vibration is not something a caller composes into a style. It
// also carries a user preference, which the design tokens do not.

export const theme = { colors, spacing, radii, typography, motion, elevation };
export type Theme = typeof theme;

// ─── UI 2.0 ("Tactile") — light + dark ────────────────────────────────────
/**
 * The redesign palette, chosen 2026-09-06 from the Home direction boards
 * (canvas "Fluenci UI 2.0", board D3). It lives beside the Dark Glow tokens
 * above rather than replacing them: screens migrate one at a time on
 * `redesign/ui-2.0`, and a screen that has not migrated keeps rendering from
 * `colors`. Read it through `useUi2Theme()` (hooks/useUi2Theme.ts), which
 * picks light or dark from the OS setting.
 *
 * Contrast, checked against each scheme's `bg`: ink is 14.8:1 light / 17.2:1
 * dark; muted is 5.1:1 light / 8.9:1 dark; white on `primary` is 5.6:1 light /
 * 4.6:1 dark. Nothing below AA.
 */
export const ui2Light = {
  bg: '#FFFFFF',
  surface2: '#F5F4FA',
  /** Tint blocks (2026-09-07): a card is a solid tinted fill on the ground, no
   *  outline. `cardBorder` equals `card` so any leftover hardcoded border
   *  disappears into the fill instead of drawing a Duolingo-style stroke. */
  card: '#F3F1F9',
  cardBorder: '#F3F1F9',
  ink: '#23203A',
  muted: '#6E6A88',
  idle: '#8C88A6',
  primary: '#6A4CFF',
  slab: '#4D33D6',
  primaryTint: '#EFEBFF',
  primaryTintBorder: '#D9D1FF',
  /** Text on primaryTint: primary itself is 4.4:1 there, just under AA. */
  onTint: '#4D33D6',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#E8E3FF',
  ctaOnPrimaryBg: '#FFFFFF',
  ctaOnPrimarySlab: '#D9D1FF',
  ctaOnPrimaryText: '#6A4CFF',
  /** Amber (canvas "Yellow · candidates", Y1, picked 2026-09-08). The old
   *  #FFC857 was Duolingo's #FFC800 with a touch of warmth and read as theirs. */
  yellow: '#F5A524',
  yellowTint: '#FDF0DA',
  yellowBorder: '#F6DDA9',
  green: '#33C48D',
  greenTint: '#E6F8F0',
  greenBorder: '#BFEBD8',
  /** Text on a solid `green` block: 8.6:1 light. */
  onGreen: '#0B3D2B',
  /** Text on a solid `error` block. */
  onError: '#FFFFFF',
  pink: '#FF5C8A',
  pinkTint: '#FFE9F1',
  track: '#EFEBFF',
  /** Unfilled progress when the bar sits ON a card: the card is already a tint,
   *  so the groove goes to the ground colour to stay visible. */
  trackOnCard: '#FFFFFF',
  /** The app icon's ramp (Home "S1 · Quiet", 2026-09-10): cyan → sky → violet →
   *  magenta on navy. Fixed — the logo does not change with the scheme — and
   *  used only as the brand gradient (`components/ui2/BrandRamp`) and the
   *  cyan Start pill. Text on `logoAqua` is `onLogo`, the icon's navy (14:1). */
  logoAqua: '#0DEFFF',
  logoSky: '#47A7FC',
  logoViolet: '#855BFB',
  logoMagenta: '#C60EFA',
  onLogo: '#00021B',
  error: '#E5484D',
} as const;

export type Ui2Palette = Record<keyof typeof ui2Light, string>;

export const ui2Dark: Ui2Palette = {
  bg: '#0C0B14',
  surface2: '#100E1C',
  card: '#17152A',
  cardBorder: '#17152A',
  ink: '#F4F2FF',
  muted: '#A6A2C2',
  idle: '#6C6890',
  // #7C63FF (the boards' value) is 4.2:1 under white; one step darker clears AA.
  primary: '#7057FF',
  slab: '#5641D9',
  primaryTint: '#2A2450',
  primaryTintBorder: '#3E3670',
  onTint: '#C4B5FD',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#E8E3FF',
  ctaOnPrimaryBg: '#FFFFFF',
  ctaOnPrimarySlab: '#CFC6FF',
  ctaOnPrimaryText: '#5641D9',
  yellow: '#FFB340',
  yellowTint: '#3A2E16',
  yellowBorder: '#4F4020',
  green: '#33C48D',
  greenTint: '#1A3A2F',
  greenBorder: '#245244',
  onGreen: '#0B3D2B',
  // Dark error is #FF6B70; white on it is 3:1, near-black ink is 8:1.
  onError: '#1A0E10',
  pink: '#FF5C8A',
  pinkTint: '#3A2230',
  track: '#26224A',
  trackOnCard: '#26224A',
  logoAqua: '#0DEFFF',
  logoSky: '#47A7FC',
  logoViolet: '#855BFB',
  logoMagenta: '#C60EFA',
  onLogo: '#00021B',
  error: '#FF6B70',
};

/**
 * Night reading — the reader's amber-on-true-black palette (2026-09-09).
 *
 * WHY IT EXISTS. iOS gives an app no access to Night Shift, so the only lever
 * an app has over blue light is the colour of the pixels it paints. On an OLED
 * panel a `#000000` pixel is switched off and emits nothing, and a pixel whose
 * blue byte is `00` emits no blue at all. So the palette below is the practical
 * floor: black ground, amber foregrounds, and a blue channel of zero on every
 * one of the 30 keys — `hooks/useUi2Theme.test.ts` asserts that byte on each.
 * A tinted overlay could not do this: alpha blending only scales blue down,
 * and it dims contrast with it.
 *
 * WHERE IT APPLIES. Only inside a `<Ui2VariantProvider variant="warm">`, which
 * the reader mounts around itself when the learner's Night reading preference
 * is on. Nothing outside the reader ever renders from it. It is not a third
 * scheme: `useUi2Theme()` reports `scheme: 'dark'` under it, because every
 * `scheme === 'dark'` branch in the app asks "is the ground dark?", and here
 * it is.
 *
 * SEMANTIC HUES ARE REMAPPED, not kept. Violet, green, pink and the error red
 * all carry blue, so `primary` becomes amber, `green` olive, `pink` orange and
 * `error` red-orange. That is only acceptable because the design rules already
 * forbid colour-only feedback — every verdict pairs an icon and a label — so a
 * shifted hue changes nothing a learner relies on. White is never used
 * either (`onPrimary` is dark ink on amber): white is one third blue.
 *
 * Contrast against `bg`: ink 10.9:1, muted 6.1:1, primary 8.8:1; onPrimary on
 * primary 7.9:1; onTint on primaryTint 10.0:1; muted on card 5.5:1. `idle` is
 * 3.1:1, the same non-text role it has in the other two palettes.
 */
export const ui2Warm: Ui2Palette = {
  bg: '#000000',
  surface2: '#0A0700',
  card: '#161100',
  cardBorder: '#161100',
  ink: '#F5AE00',
  muted: '#B88000',
  idle: '#7A5500',
  primary: '#E09A00',
  slab: '#B87E00',
  primaryTint: '#2A1E00',
  primaryTintBorder: '#3D2C00',
  onTint: '#FFC000',
  onPrimary: '#1A1000',
  onPrimaryMuted: '#4A3000',
  ctaOnPrimaryBg: '#1A1000',
  ctaOnPrimarySlab: '#000000',
  ctaOnPrimaryText: '#FFC000',
  yellow: '#FFCC00',
  yellowTint: '#2E2400',
  yellowBorder: '#4A3A00',
  green: '#9CB000',
  greenTint: '#161A00',
  greenBorder: '#2E3400',
  onGreen: '#101400',
  onError: '#1A0600',
  pink: '#FF7A00',
  pinkTint: '#2E1600',
  track: '#1F1800',
  trackOnCard: '#2A2000',
  // The reader never renders Home; these keep the key set whole and blue-free.
  logoAqua: '#FFC000',
  logoSky: '#F5AE00',
  logoViolet: '#E09A00',
  logoMagenta: '#FF7A00',
  onLogo: '#1A1000',
  error: '#FF4A00',
};

/**
 * Reader body faces. Manrope is the UI voice everywhere else; Fraunces is the
 * one serif in the binary, and its 400 weight is loaded for exactly this — a
 * long-form reading option, never UI chrome (DESIGN.md: "No serif in UI 2.0").
 */
export const ui2ReaderType = {
  sans: 'Manrope_400Regular',
  serif: 'Fraunces_400Regular',
} as const;


/**
 * UI 2.0 type: Manrope for everything (canvas page "Slab-free · A/B/C",
 * variant C, picked 2026-09-07). Nunito went because it is the free stand-in
 * for Duolingo's rounded Feather Bold and carried every label; Plus Jakarta
 * went with it so the app has one voice.
 */
export const ui2Type = {
  heading: 'Manrope_800ExtraBold',
  headingBold: 'Manrope_700Bold',
  ui: 'Manrope_600SemiBold',
  uiBold: 'Manrope_700Bold',
  uiHeavy: 'Manrope_800ExtraBold',
} as const;

/**
 * UI 2.0 shape: Tint blocks. No outline and no bottom slab anywhere — a card
 * is a filled block, a button is a filled pill. The slab keys are kept at 0 so
 * every `borderBottomWidth: shape.slab` in the tree collapses without a
 * per-file edit; do not raise them again (the slab was the strongest single
 * Duolingo tell, see DESIGN.md "UI 2.0 › Shape and type").
 */
export const ui2Shape = {
  radiusCard: 22,
  radiusHero: 28,
  radiusButton: 999,
  border: 0,
  slab: 0,
  slabPressed: 0,
  buttonSlab: 0,
} as const;
