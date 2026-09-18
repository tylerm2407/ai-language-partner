/**
 * The contract every in-app script input method implements.
 *
 * WHY THIS EXISTS. Four of the ten courses — Japanese, Korean, Chinese,
 * Russian — are written in a script that is not on an English phone keyboard,
 * and roughly 1,150 typed exercises per language ask the learner to produce it.
 * Neither iOS nor Android lets an app install or select a system keyboard, so
 * until now a learner who had not already added a Japanese keyboard in the
 * phone's own settings could not answer a single one of those items. The
 * grader even assumed otherwise: the tolerance comment in lib/grading.ts
 * reasons about how もっと良い "is typed `motto yoi` and converted", which was
 * true of an IME the app did not have.
 *
 * So the app brings its own. The learner types on the Latin keyboard they
 * already have and the text is converted before it is graded, which means what
 * reaches the grader is real script and nothing downstream has to change.
 */

import type { LanguageCode } from '../../types';

/**
 * What a keystroke buffer converts to.
 *
 * `text` is settled and safe to put in the field. `pending` is the tail that
 * could still become something else — the `k` of `ka`, the `ni` of `nihao` —
 * and is shown underlined rather than committed, exactly as a system IME shows
 * its composition.
 */
export interface Conversion {
  text: string;
  pending: string;
}

/** A conversion the learner picks from a bar above the keyboard. */
export interface Candidate {
  /** What gets inserted. */
  text: string;
  /** The reading it was matched on, shown under the candidate. */
  reading: string;
}

export interface ScriptInputEngine {
  language: LanguageCode;
  /**
   * What the learner types to drive it, named the way learners name it:
   * "romaji", "pinyin", "romaja", "Latin letters".
   */
  romanization: string;
  /** One-line instruction shown the first time the bar appears. */
  hint: string;
  /**
   * Convert a buffer of Latin keystrokes. Pure: the same buffer always gives
   * the same result, so the caller can re-run it on every keystroke.
   */
  convert(buffer: string): Conversion;
  /**
   * The same conversion, with nothing held back, for text that is LEAVING the
   * field — submitted, graded, saved.
   *
   * `convert` deliberately keeps an ambiguous tail in composition: the `t` of
   * `privet` could still become `ts`, so committing it as т on the keystroke
   * would be wrong. But a learner who has finished typing and pressed Check
   * has settled it, and their word must not lose its last letter. Everything
   * the field shows is `convert`; everything it yields is `settle`.
   */
  settle(buffer: string): string;
  /**
   * Conversions offered for `pending`, best first.
   *
   * `context` is text the learner is likely to need right now — the exercise's
   * expected answer and its accepted alternatives. Entries matching it sort to
   * the front. It is NOT a source of new candidates: an answer that is not in
   * the lexicon must not become tappable, or the bar would hand the learner
   * the answer.
   */
  candidates(pending: string, context: readonly string[]): Candidate[];
  /**
   * Keys for the on-screen pad, in rows, for learners who would rather tap the
   * script directly than transliterate. Empty where a pad makes no sense
   * (Chinese has no finite key set).
   */
  keypad: readonly (readonly string[])[];
  /** Labels for the pad's pages, parallel to `keypadPages`. */
  keypadPages?: readonly { label: string; rows: readonly (readonly string[])[] }[];
  /**
   * True where the space bar commits the leading candidate instead of typing a
   * space, which is what every Chinese IME does and what a learner who has
   * typed on one will reach for. Languages that convert without choosing
   * (Russian, Korean, Japanese kana) leave it off: there, space is a space.
   */
  commitOnSpace?: boolean;
}
