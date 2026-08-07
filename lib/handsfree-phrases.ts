/**
 * Fixed spoken lines for a hands-free session.
 *
 * THIS IS A COST CONTROL, NOT COPY POLISH.
 *
 * The tts function charges one voice-minute per *uncached* generation, and its
 * server-side cache is content-addressed on the exact string. So every
 * distinct sentence this module can emit is a separate billed generation the
 * first time any learner hears it — and a free cache hit for everyone
 * thereafter, forever.
 *
 * That makes the phrase count, not the phrase wording, the thing that matters.
 * A 20-minute session is roughly 20 cards; if feedback were phrased per card
 * ("Not quite, the answer was la manzana") every single line would be a fresh
 * generation and the session would exhaust a premium learner's entire daily
 * voice allowance. Holding the common lines constant means the only per-card
 * generations are the prompts themselves.
 *
 * Rules for anyone editing this file:
 *   - Keep the set SMALL. Every new string costs a generation per language.
 *   - Keep the strings CONSTANT. No interpolation in the common cases.
 *   - Do not add flavour variants. Ten ways to say "correct" is ten times the
 *     cost for no learning benefit, and in a car the learner is not listening
 *     for novelty.
 *
 * The one interpolated line is the incorrect-answer case, which has to say the
 * expected answer aloud — there is no way to teach a missed card without it.
 * It is priced as a per-card generation deliberately.
 */

import type { FeedbackPhraseKey } from './handsfree-session';

/**
 * Feedback lines. `incorrect` is the only one that varies, and only by the
 * answer it has to speak.
 */
const FEEDBACK: Record<string, Record<FeedbackPhraseKey, string>> = {
  en: {
    correct: 'Correct.',
    close: 'Close.',
    incorrect: 'The answer is',
    not_caught: "I didn't catch that.",
  },
};

const ANNOUNCE: Record<string, { withTotal: (n: number, total: number) => string; withoutTotal: (n: number) => string }> = {
  en: {
    withTotal: (n, total) => `Card ${n} of ${total}.`,
    withoutTotal: (n) => `Card ${n}.`,
  },
};

const SUMMARY: Record<string, (attempted: number, correct: number) => string> = {
  en: (attempted, correct) =>
    attempted === 0
      ? 'Session finished. Nothing reviewed this time.'
      : `Session finished. ${correct} of ${attempted} correct.`,
};

const FALLBACK_LANGUAGE = 'en';

function langKey(language: string): string {
  const key = (language || '').slice(0, 2).toLowerCase();
  return key in FEEDBACK ? key : FALLBACK_LANGUAGE;
}

/**
 * The line to speak after an answer.
 *
 * Spoken in the learner's OWN language, not the target language. Being told
 * "incorrecto" by a machine you cannot see, while driving, at A1, is not
 * immersion — it is a guess about whether the app is broken.
 */
export function feedbackPhrase(
  key: FeedbackPhraseKey,
  nativeLanguage: string,
  expectedText?: string,
): string {
  const table = FEEDBACK[langKey(nativeLanguage)];
  if (key === 'incorrect' && expectedText) {
    return `${table.incorrect} ${expectedText}.`;
  }
  // Without an expected answer there is nothing useful to say beyond marking
  // it wrong, so fall back to the close-but-wrong line rather than emitting a
  // dangling "The answer is".
  if (key === 'incorrect') return table.close;
  return table[key];
}

/** "Card 3 of 20." — constant per position, so it caches across learners. */
export function announcePhrase(
  index: number,
  total: number | null,
  nativeLanguage: string,
): string {
  const table = ANNOUNCE[langKey(nativeLanguage)];
  return total === null ? table.withoutTotal(index) : table.withTotal(index, total);
}

/** Closing line. One generation per (attempted, correct) pair seen. */
export function summaryPhrase(
  attempted: number,
  correct: number,
  nativeLanguage: string,
): string {
  return SUMMARY[langKey(nativeLanguage)](attempted, correct);
}

/**
 * Lines that are identical for every learner and therefore always a server
 * cache hit after the first ever use. Pre-warming these makes the fixed part
 * of a session free.
 */
export function constantPhrases(nativeLanguage: string): string[] {
  const table = FEEDBACK[langKey(nativeLanguage)];
  return [table.correct, table.close, table.not_caught];
}
