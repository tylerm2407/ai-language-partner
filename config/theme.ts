/**
 * Theme tokens — single source of truth for the redesigned UI.
 * See redesign-plan.md for rationale; see design-research.md for empirical
 * citations behind each choice.
 *
 * Canonical palette is DARK. Body text is validated WCAG AAA (≥7:1) against
 * surface.base (#0C0F14). Primary is Indigo #6366F1 with a brighter #818CF8
 * variant for accents that must stay legible on dark.
 */

// ─── Colors ──────────────────────────────────────────────────────────────
export const colors = {
  /** Screen-level surfaces, from darkest to progressively lighter */
  surface: {
    base: '#0C0F14', // primary app background (most ornamental screens)
    raised: '#12161D', // reading / review / lesson content (+ contrast for focus)
    card: '#151921',
    cardAlt: '#1C212B',
    overlay: 'rgba(12, 15, 20, 0.85)', // modal backdrops
    sheet: '#1A1F29', // bottom-sheet fill
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
    primary: '#F1F5F9', // 14.6:1 (AAA)
    secondary: '#CBD5E1', // 10.2:1 (AAA)
    tertiary: '#94A3B8', // 5.8:1 (AA large)
    quaternary: '#64748B', // 3.7:1 (placeholders only)
    onPrimary: '#FFFFFF', // text on indigo.500 button
    onSuccess: '#052E1A', // dark text on bright success (if used)
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
    tint: 'rgba(245, 158, 11, 0.18)',
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
    glassBg: 'rgba(20,25,50,0.5)',
    glassBorder: 'rgba(255,255,255,0.10)',
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
export const typography = {
  family: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    display: 'PlayfairDisplay_700Bold', // celebration / hero only
    serif: 'Georgia', // magazine editorial headlines (system font on iOS, Noto Serif on Android)
    mono: 'JetBrainsMono_400Regular',
    monoMedium: 'JetBrainsMono_500Medium',
  },
  scale: {
    // Title / Display
    hero: { fontSize: 32, lineHeight: 38, weight: 'bold' as const },
    h1: { fontSize: 28, lineHeight: 34, weight: 'bold' as const },
    h2: { fontSize: 24, lineHeight: 30, weight: 'bold' as const },
    h3: { fontSize: 22, lineHeight: 28, weight: 'semibold' as const },
    // Body
    bodyLg: { fontSize: 17, lineHeight: 25, weight: 'semibold' as const },
    body: { fontSize: 16, lineHeight: 24, weight: 'regular' as const },
    bodySm: { fontSize: 14, lineHeight: 20, weight: 'regular' as const },
    // Meta
    caption: { fontSize: 13, lineHeight: 18, weight: 'medium' as const },
    tiny: { fontSize: 12, lineHeight: 16, weight: 'medium' as const },
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
