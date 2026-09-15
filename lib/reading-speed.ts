/**
 * One source of truth for how long a text takes a learner to read.
 *
 * Two constants used to disagree. Home estimated at 140 wpm ("a learner's pace
 * — in a second language"); the book detail screen at 200 wpm. The same
 * 14,000-word book was therefore "100 min" on one screen and "70 min" on the
 * next, and nothing in the codebase owned the number.
 *
 * 140 is the one that survived. It is the figure that had a reason written
 * next to it, and a second-language reader is slower than a native one, not
 * faster — 200 wpm is roughly native silent-reading pace, which is not who is
 * holding the phone. Estimating long is also the kinder direction to be wrong
 * in: a book that finishes early is a good surprise, one that runs over is a
 * broken promise.
 *
 * Deliberately flat rather than per-CEFR-band. No per-band speed data exists
 * anywhere in this project (`lib/cefr-labels.ts` carries can-do text and band
 * colours only, and `.claude/rules/learning.md` has no timing model), so a
 * band curve would be invented precision — exactly the kind of number §3 says
 * not to show a learner.
 */

/** Words per minute for a learner reading in their target language. */
export const LEARNER_WORDS_PER_MINUTE = 140;

/**
 * Minutes to read `wordCount` words, rounded, never rounded down to zero for
 * a text that has any words in it.
 *
 * Returns 0 — not 1 — for an empty, missing or nonsensical count, so callers
 * can tell "no estimate available" from "a very short text" and omit the
 * label entirely rather than printing a confident "~1 min" about nothing.
 */
export function estimatedReadMinutes(wordCount: number): number {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 0;
  return Math.max(1, Math.round(wordCount / LEARNER_WORDS_PER_MINUTE));
}

/**
 * Minutes left in a book that is `percentComplete` (0..100) read.
 *
 * `percent_complete` is a server-stored numeric(5,2) written by the reader on
 * every page turn, so it is clamped here rather than trusted: a value slightly
 * over 100 (rounding on the final page) must not produce negative minutes.
 */
export function remainingReadMinutes(wordCount: number, percentComplete: number): number {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 0;
  const percent = Number.isFinite(percentComplete)
    ? Math.min(100, Math.max(0, percentComplete))
    : 0;
  return estimatedReadMinutes(Math.round(wordCount * (1 - percent / 100)));
}

/**
 * Human duration: `45 min`, `1 hr`, `2 hr 20 min`.
 *
 * No tilde — callers add "~" where they are presenting an estimate, because
 * the same string is also used in accessibility labels where a stray tilde
 * reads aloud as noise.
 *
 * Returns '' for 0 so a caller that forgot to check still renders nothing
 * rather than "0 min".
 */
export function formatReadDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
