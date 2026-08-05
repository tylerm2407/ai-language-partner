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
  },

  /** Semantic action roles. Fills must clear AA against text.onPrimary, which
   *  indigo.500 does NOT (4.47:1) — every CTA fill goes through these. */
  action: {
    primaryFill: '#4F46E5', // indigo.600 — white 6.4:1
    primarySlab: '#3730A3', // indigo.800 — tactile slab drops one step with the fill
    primaryTint: 'rgba(99, 102, 241, 0.15)',
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
  streak: {
    base: '#F59E0B',
    fire: '#F97316',
    /** Orange-based so a streak chip never reads as a warning chip — the two
     *  sat side by side on Home in identical amber. */
    tint: 'rgba(249, 115, 22, 0.15)',
    light: '#FDBA74', // streak chip label on dark
  },
  premium: {
    base: '#A855F7',
    tint: 'rgba(168, 85, 247, 0.18)',
  },

  /** League tier colors (kept from existing DESIGN.md) */
  league: {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#A78BFA',
    diamond: '#38BDF8',
  },

  /** Heart colors (gamification) */
  heart: {
    filled: '#EF4444',
    empty: '#64748B',
  },

  /** Magazine / editorial palette */
  magazine: {
    nebulaTop: '#0a0520',
    nebulaMid: '#1a0a3e',
    accentBlue: '#4F8EF7',
    accentViolet: '#7C3AED',
    accentLilac: '#A855F7',
    heartsCoral: '#FF6B6B',
    xpGold: '#FFB547',
    streakFlame: '#FF8A3D',
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
