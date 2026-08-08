/**
 * Gradient + surface constants. `config/theme.ts` is canonical for colors —
 * everything here either composes those tokens or is a gradient stop pair.
 *
 * Under the Dark Glow theme the former glass tokens are OPAQUE. Depth is
 * supplied once, by the ambient glow layer behind content
 * (components/ui/GlowBackground.tsx); per-card translucency competed with it.
 */

/** Progress fills, XP popups, LevelBadge bar — lilac → sky. */
export const GRADIENT_COLORS = ['#A855F7', '#38BDF8'] as const;
export const GRADIENT_COLORS_TRANSLUCENT = ['rgba(168,85,247,0.20)', 'rgba(56,189,248,0.12)'] as const;
export const GRADIENT_START = { x: 0, y: 0.5 };
export const GRADIENT_END = { x: 1, y: 0.5 };

/** Gradient RULES (GradientBorderCard, active tab circle, play buttons) —
 *  indigo.600 → premium lilac, the deck's `linear-gradient(135deg, …)`. */
export const BORDER_GRADIENT_COLORS = ['#4F46E5', '#A855F7'] as const;

export const BG_GRADIENT_COLORS = ['#0F1A2E', '#150F24'] as const;
export const DARK_BG = '#08090F';
export const DARK_CARD = '#151921';

/** Glow blob palette — kept under the old AURORA_* names because several
 *  components import them; these are now the glow layer's colors. */
export const AURORA_BASE = ['#08090F', '#0E1119', '#060710'] as const;
export const AURORA_BLUE = '#6366F1';
export const AURORA_VIOLET = '#7C3AED';
export const AURORA_LILAC = '#818CF8';

/** Card surface tokens. Opaque — see the file header. */
export const GLASS_BG = '#151921';
export const GLASS_HIGHLIGHT = ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)'] as const;
export const GLASS_BORDER = 'rgba(255, 255, 255, 0.12)';

/** Magazine / editorial surfaces. Same card fill as everything else — the
 *  editorial direction is carried by type (Fraunces + mono), not by a
 *  different card color. */
export const DEEP_NEBULA = ['#08090F', '#0E1119', '#060710'] as const;
export const MAGAZINE_GLASS_BG = '#151921';
export const MAGAZINE_GLASS_BORDER = 'rgba(255,255,255,0.12)';
