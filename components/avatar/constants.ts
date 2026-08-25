/**
 * Render sizes for the Avatar component.
 *
 * These numbers are load-bearing beyond layout: the FRAMING block in
 * supabase/functions/_shared/avatar-styles.ts requires every generated avatar
 * to stay legible at the smallest of them, and the preset library was art
 * directed against the same floor. Raising `small` is free; lowering it
 * invalidates artwork.
 *
 * The palettes and DEFAULT_AVATAR_CONFIG that used to live here went with the
 * procedural SVG avatar — they only ever fed its layer pickers.
 */
export const AVATAR_SIZES = { small: 32, medium: 64, large: 128 } as const;
