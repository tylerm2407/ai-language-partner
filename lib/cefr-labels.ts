/**
 * How a CEFR level is allowed to render.
 *
 * "B1" is not a progress indicator to anyone who has not sat a Council of
 * Europe exam. It is an acronym for a scale most learners have never heard of,
 * and shipping it bare is the same mistake as shipping a point total: a figure
 * that looks like information and carries none. Every surface that shows a
 * level pairs the code with the one thing the learner actually wants to know —
 * what they can do at it.
 *
 * The can-do lines are deliberately *language-neutral*. Fluenci teaches a dozen
 * target languages from one string table; a line that named a language, a
 * script or a culture would need twelve variants and would be wrong in eleven.
 * They are also shortened from the official Council of Europe global scale
 * descriptors rather than invented, so the claim behind the code stays true.
 *
 * The colour map lived in three screens (the Learn library, BookCard and
 * ContinueReadingSection), each covering A1–B2 only, so C1 and C2 silently fell
 * through to grey — a C2 book looked less advanced than a B2 one. It lives here
 * now, with the full ladder. Colour is never the only cue: the code itself is
 * always rendered next to the swatch.
 *
 * Pure module: no React, no network, no clock.
 */

import { normalizeBand, type CefrBand } from './cefr-proficiency';
import { colors } from '../config/theme';

/**
 * One can-do line per band. Kept to a single clause so it fits under a badge
 * or beside a header without wrapping past two lines at accessibility text
 * sizes.
 */
export const CEFR_CAN_DO: Record<CefrBand, string> = {
  A1: 'Handle simple, everyday phrases and introductions',
  A2: 'Handle short, routine exchanges on familiar topics',
  B1: 'Handle most situations while travelling, and describe experiences',
  B2: 'Discuss familiar and abstract topics with growing confidence',
  C1: 'Express yourself fluently and precisely on complex topics',
  C2: 'Handle anything you read or hear with ease and nuance',
};

/** Spoken when there is no usable band — an untagged book, a profile that has
 *  not been through onboarding. Silence would leave a VoiceOver user with a
 *  control whose purpose is unstated. */
const UNKNOWN_ACCESSIBILITY_LABEL = 'Level not set.';

/**
 * Content CEFR tags are free text (`'a2'`, `'A2 '`, `'B1-B2'`) and profiles can
 * be missing one entirely, so everything here takes the raw value and
 * normalises rather than trusting the caller to have a `CefrBand` in hand.
 * An unrecognisable tag yields empty output rather than echoing the garbage
 * back at the learner.
 */
export function cefrCanDo(band: string | null | undefined): string {
  const normalized = normalizeBand(band);
  return normalized ? CEFR_CAN_DO[normalized] : '';
}

/** The full visible form: `"B1 · Handle most situations while travelling…"`. */
export function cefrLabel(band: string | null | undefined): string {
  const normalized = normalizeBand(band);
  return normalized ? `${normalized} · ${CEFR_CAN_DO[normalized]}` : '';
}

/**
 * The spoken form, for the small badges and pills where the code has to stay
 * bare because a full sentence will not fit. Sentence-punctuated so VoiceOver
 * pauses between the level and its meaning instead of running them together.
 */
export function cefrAccessibilityLabel(band: string | null | undefined): string {
  const normalized = normalizeBand(band);
  return normalized
    ? `Level ${normalized}. ${CEFR_CAN_DO[normalized]}.`
    : UNKNOWN_ACCESSIBILITY_LABEL;
}

// ─── Band colours ───────────────────────────────────────────────

export interface CefrBandColors {
  /** Tint fill behind the badge. */
  bg: string;
  /** Code text and icon colour on that fill. */
  text: string;
}

/**
 * A1–B2 keep the hues the three screens already agreed on. C1 and C2 take
 * violet and orange — the two remaining semantic families — so the top of the
 * ladder is no longer indistinguishable from an untagged book.
 */
export const CEFR_BAND_COLORS: Record<CefrBand, CefrBandColors> = {
  A1: { bg: colors.success.tint, text: colors.success.light },
  A2: { bg: colors.action.primaryTint, text: colors.action.accent },
  B1: { bg: colors.warning.tint, text: colors.warning.light },
  B2: { bg: colors.error.tint, text: colors.error.light },
  C1: { bg: colors.premium.tint, text: colors.premium.base },
  C2: { bg: colors.flame.tint, text: colors.flame.light },
};

/** Neutral chip for content whose tag we cannot read. */
export const CEFR_BAND_COLORS_UNKNOWN: CefrBandColors = {
  bg: colors.surface.cardAlt,
  text: colors.text.tertiary,
};

export function cefrBandColors(band: string | null | undefined): CefrBandColors {
  const normalized = normalizeBand(band);
  return normalized ? CEFR_BAND_COLORS[normalized] : CEFR_BAND_COLORS_UNKNOWN;
}
