/**
 * Chinese input: pinyin in, characters chosen from a candidate bar.
 *
 * Chinese is the one script here that cannot be converted, only SELECTED. A
 * syllable like `shi` is written by dozens of unrelated characters, so no rule
 * turns keystrokes into text — something has to offer 是 十 时 事 and let the
 * learner point at one. That is what every Chinese IME does, and it is the
 * only honest way to do it.
 *
 * What it offers is bounded by the curriculum (see zh-lexicon.ts). That is a
 * real limit — a word the courses do not teach cannot be typed as a word, only
 * character by character — and it is the trade that makes the feature shippable
 * at all: a general IME dictionary is a download, a frequency model and a
 * segmenter we do not have. A learner with a system Chinese keyboard installed
 * can still use it; this is the floor, not a replacement.
 */

import type { ScriptInputEngine, Conversion, Candidate } from './types';
import { ZH_LEXICON } from './zh-lexicon';

interface Entry { text: string; pinyin: string[] }

/**
 * Parsed on FIRST USE, not at import: index.ts loads every engine, so parsing
 * 4,000 entries eagerly would charge a Spanish learner for a Chinese table.
 * `BY_PINYIN` is the exact-reading index, so the common case is a lookup
 * rather than a scan of the list.
 */
let lexicon: { entries: Entry[]; byPinyin: Map<string, Entry[]> } | null = null;
function index(): { entries: Entry[]; byPinyin: Map<string, Entry[]> } {
  if (lexicon) return lexicon;
  const entries: Entry[] = ZH_LEXICON.split('\n')
    .filter(Boolean)
    .map((line) => {
      const [pinyin, text] = line.split('\t');
      return { text, pinyin: pinyin.split('|') };
    });
  const byPinyin = new Map<string, Entry[]>();
  for (const entry of entries) {
    for (const p of entry.pinyin) {
      const bucket = byPinyin.get(p);
      if (bucket) bucket.push(entry);
      else byPinyin.set(p, [entry]);
    }
  }
  lexicon = { entries, byPinyin };
  return lexicon;
}

/** Learners type `lv` or `lu` for lü; the lexicon stores `v`. */
function normalizePinyin(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, '').replace(/ü/g, 'v');
}

const MAX_CANDIDATES = 20;

/**
 * Characters and words for the pinyin typed so far.
 *
 * Exact readings come first, then readings this is a prefix of — typing `ni`
 * offers 你 before 你们, and `nihao` offers 你好 at the top. Anything the
 * exercise is actually asking for is lifted to the front, because a learner
 * hunting through twenty homophones for the word they were just taught is the
 * failure mode this bar exists to prevent.
 */
export function pinyinCandidates(pending: string, context: readonly string[]): Candidate[] {
  const query = normalizePinyin(pending);
  if (!query) return [];

  const seen = new Set<string>();
  const exact: Candidate[] = [];
  const prefix: Candidate[] = [];

  const { entries, byPinyin } = index();
  for (const entry of byPinyin.get(query) ?? []) {
    if (seen.has(entry.text)) continue;
    seen.add(entry.text);
    exact.push({ text: entry.text, reading: query });
  }
  for (const entry of entries) {
    if (prefix.length >= MAX_CANDIDATES * 2) break;
    if (seen.has(entry.text)) continue;
    const match = entry.pinyin.find((p) => p.startsWith(query));
    if (!match) continue;
    seen.add(entry.text);
    prefix.push({ text: entry.text, reading: match });
  }

  // `context` re-ranks; it never adds. A candidate bar that could surface a
  // string only because it is this row's answer would be handing the answer
  // over, which is a different feature from being able to type.
  const wanted = new Set(context);
  const rank = (c: Candidate) => (wanted.has(c.text) ? 0 : 1);
  return [...exact, ...prefix]
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, MAX_CANDIDATES);
}

/**
 * Pinyin never converts on its own, so everything typed stays in composition
 * until a candidate is picked. Only characters pinyin cannot contain — a
 * space, a comma, a digit — settle immediately.
 */
export function pinyinComposition(buffer: string): Conversion {
  const cut = buffer.search(/[^a-zA-Zü]/);
  if (cut < 0) return { text: '', pending: buffer };
  return { text: buffer.slice(0, cut + 1), pending: buffer.slice(cut + 1) };
}

export const chineseInput: ScriptInputEngine = {
  language: 'zh',
  romanization: 'pinyin',
  hint: 'Type pinyin without tones, then tap a character',
  composing: /[A-Za-z'’ü-]+$/,
  convert: pinyinComposition,
  // Pinyin nobody converted stays pinyin. It will be graded wrong, which is
  // the truth: the learner did not write Chinese. Silently deleting it would
  // be worse — they would submit an empty answer without knowing why.
  settle: (buffer) => {
    const { text, pending } = pinyinComposition(buffer);
    return text + pending;
  },
  candidates: pinyinCandidates,
  keypad: [],
  commitOnSpace: true,
};
