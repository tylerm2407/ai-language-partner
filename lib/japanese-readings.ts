/**
 * Japanese written forms and the readings the curriculum authored for them —
 * and the single question the grader asks of that pairing: *is this kana the
 * reading of this word?*
 *
 * WHY THIS EXISTS. The orthography ruling of 2026-09-16 accepted the kana
 * reading on every written-production row whose cue is an English gloss: a
 * learner asked to write "Nurse" and typing かんごし has written Japanese, and
 * is right. 385 rows carry a kana alternative that says so. 485 do not, and on
 * those a correct answer is marked wrong — the same defect Duolingo's Japanese
 * course is best known for, where 働きます is refused because only はたらきます
 * is on the list. This module is how the grader answers the question by data
 * instead of by list-keeping.
 *
 * READINGS ARE AUTHORED, NEVER DERIVED. Every pair here was written by a human
 * into `metadata.reading` on a `script_choice` row (migration 138), one per
 * kanji-bearing Japanese card, and reaches this file through
 * `lib/script-input/ja-lexicon.ts` — the same table the in-app input method
 * converts with, so what a learner can type and what the grader will accept
 * cannot drift apart.
 *
 * Composing a reading out of per-character readings was considered and
 * rejected. Japanese compounds are not the sum of their characters: 明日 is
 * あした, not めいにち; 一日 is ついたち; rendaku voices the second element of
 * half the compounds in the A1 list. A composed reading would refuse あした —
 * the right answer, still wrong — AND accept めいにち, which is not a word.
 * That is strictly worse than the bug it set out to fix. A reading nobody
 * authored is a reading this module does not know, and it says so.
 */

import { JA_LEXICON } from './script-input/ja-lexicon';

/**
 * Katakana to hiragana.
 *
 * Readings are authored in hiragana, but a learner converting `kangoshi` may
 * well have the katakana page of the keypad open, and カンゴシ is the same
 * reading. The long-vowel mark ー is deliberately kept rather than folded to a
 * vowel: it is how katakana writes length, and folding it would make コーヒー
 * and こひ compare equal.
 */
export function foldKana(text: string): string {
  return text
    .normalize('NFC')
    .trim()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCodePoint(ch.codePointAt(0)! - 0x60));
}

/** Hiragana, katakana, the long-vowel mark, and nothing else. */
const KANA_ONLY = /^[ぁ-ゟ゠-ヿ]+$/;
/** Han. A written form without one of these has no reading to be accepted BY. */
const HAN = /[㐀-䶿一-鿿豈-﫿]/;

/**
 * True when the whole string is kana.
 *
 * Deliberately strict: 看ごし is a half-converted answer, not a reading, and
 * must fall through to ordinary grading rather than be tested against a
 * reading it cannot equal. An empty string is not kana.
 */
export function isKanaOnly(text: string): boolean {
  const folded = foldKana(text);
  return folded.length > 0 && KANA_ONLY.test(folded);
}

/** True when the string contains a Han character. */
export function hasKanji(text: string): boolean {
  return HAN.test(text);
}

/**
 * Written form -> the readings authored for it, folded to hiragana.
 *
 * Built on first use. `lib/grading.ts` imports this module and every screen
 * that grades anything imports that, so a Spanish learner would otherwise
 * index the Japanese table on the way to their first answer.
 */
let readingsByWritten: Map<string, string[]> | null = null;
function index(): Map<string, string[]> {
  if (readingsByWritten) return readingsByWritten;
  const built = new Map<string, string[]>();
  for (const line of JA_LEXICON.split('\n')) {
    if (!line) continue;
    const [reading, spellings] = line.split('\t');
    const folded = foldKana(reading);
    if (!folded) continue;
    for (const written of spellings.split('|')) {
      const bucket = built.get(written);
      if (bucket) {
        if (!bucket.includes(folded)) bucket.push(folded);
      } else {
        built.set(written, [folded]);
      }
    }
  }
  readingsByWritten = built;
  return readingsByWritten;
}

/**
 * The readings the curriculum authored for a written form.
 *
 * Empty for anything it never wrote one for — which is a fact, not a gap to
 * be filled in by guessing. 90 of the Japanese typed rows land here, all of
 * them fill-blank fragments like 護師, and a fragment has no reading of its
 * own to author.
 */
export function authoredReadings(written: string): readonly string[] {
  const map = index();
  return map.get(foldKana(written).normalize('NFC')) ?? map.get(written) ?? [];
}

/**
 * True when `candidate` is an authored reading of `written`.
 *
 * Exact only. A near-miss reading is a vocabulary error — a learner who types
 * かんごう for 看護師 does not know the word yet — and forgiving it would teach
 * the wrong pronunciation and then space it out on an SM-2 schedule.
 */
export function isAuthoredReading(candidate: string, written: string): boolean {
  if (!isKanaOnly(candidate) || !hasKanji(written)) return false;
  return authoredReadings(written).includes(foldKana(candidate));
}

/** How many written forms carry an authored reading. For tests and audits. */
export function authoredReadingCount(): number {
  return index().size;
}

/**
 * Readings that spell more than one written form — Japanese homophones the
 * curriculum teaches both halves of, such as 雨 and 飴 (both あめ) or 橋 and
 * 箸 (both はし).
 *
 * There are none today, which is why `gradeAnswer`'s homophone refusal cannot
 * currently fire. That is a fact about the frozen curriculum, not a guarantee:
 * the first authored homophone pair makes the bare reading ambiguous, and
 * accepting it would mark the same three kana correct on both rows and make
 * the contrast the lesson draws untestable by typing. The refusal is there for
 * that day, and `japanese-readings.test.ts` asserts this list is empty so the
 * day it stops being empty, the test says which pair did it.
 */
export function readingCollisions(): { reading: string; written: string[] }[] {
  const byReading = new Map<string, string[]>();
  for (const [written, readings] of index()) {
    for (const reading of readings) {
      const bucket = byReading.get(reading);
      if (bucket) bucket.push(written);
      else byReading.set(reading, [written]);
    }
  }
  return [...byReading]
    .filter(([, written]) => written.length > 1)
    .map(([reading, written]) => ({ reading, written }));
}
