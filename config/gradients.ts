/**
 * Gradient + surface constants. `config/theme.ts` is canonical for colors —
 * everything here either composes those tokens or is a gradient stop pair.
 *
 * Under Studio Graphite the former glass tokens are OPAQUE. Depth is supplied
 * by the surface steps and hairline borders, plus the single top wash in
 * components/ui/GlowBackground.tsx; per-card translucency competed with it.
 *
 * Every stop pair below now runs WITHIN the brass family rather than across
 * hues. A two-hue gradient (indigo → lilac, lilac → sky) is the thing that made
 * progress bars and tiles read as a consumer game; a tonal ramp of one metal
 * reads as material.
 */

/** Progress fills, XP popups, LevelBadge bar — brass → light brass. */
export const GRADIENT_COLORS = ['#C8A24A', '#E0BE6B'] as const;
export const GRADIENT_COLORS_TRANSLUCENT = ['rgba(200,162,74,0.20)', 'rgba(224,190,107,0.12)'] as const;
export const GRADIENT_START = { x: 0, y: 0.5 };
export const GRADIENT_END = { x: 1, y: 0.5 };

/** Gradient RULES (GradientBorderCard, active tab circle, play buttons) —
 *  deep brass → light brass, so the rule reads as a bevel on one metal. */
export const BORDER_GRADIENT_COLORS = ['#8E6F2F', '#E0BE6B'] as const;

export const BG_GRADIENT_COLORS = ['#151412', '#0F0E0C'] as const;
export const DARK_BG = '#0F0E0C';
export const DARK_CARD = '#1B1A17';

/** Ambient palette — kept under the old AURORA_* names because several
 *  components import them; these are now the top wash's colors. */
export const AURORA_BASE = ['#0F0E0C', '#151412', '#0A0908'] as const;
export const AURORA_BLUE = '#C8A24A';
export const AURORA_VIOLET = '#B08C3B';
export const AURORA_LILAC = '#E0BE6B';

/** Card surface tokens. Opaque — see the file header. */
export const GLASS_BG = '#1B1A17';
export const GLASS_HIGHLIGHT = ['rgba(245,240,230,0.06)', 'rgba(245,240,230,0)'] as const;
export const GLASS_BORDER = 'rgba(245, 240, 230, 0.13)';

/** Magazine / editorial surfaces. Same card fill as everything else — the
 *  editorial direction is carried by type (Fraunces + mono), not by a
 *  different card color. */
export const DEEP_NEBULA = ['#0F0E0C', '#151412', '#0A0908'] as const;
export const MAGAZINE_GLASS_BG = '#1B1A17';
export const MAGAZINE_GLASS_BORDER = 'rgba(245,240,230,0.13)';
