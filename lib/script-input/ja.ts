/**
 * Japanese input: romaji in, kana out, with kanji offered as candidates.
 *
 * This is wapuro romaji — the romaji every Japanese IME accepts, not strict
 * Hepburn. `si`, `shi`, `ci` and `ti` all reach し/ち, because a learner typing
 * from memory will use whichever they were taught, and an input method that
 * rejects one of them is a worse teacher than one that accepts both.
 *
 * Kana alone is a complete answer. The orthography ruling of 2026-09-16
 * accepts the reading on every written-production row whose cue is an English
 * gloss, so a learner who never opens the candidate bar is never marked wrong
 * for it. Candidates exist for learners who want to write the kanji.
 */

import type { ScriptInputEngine, Conversion, Candidate } from './types';
import { JA_LEXICON } from './ja-lexicon';
import { JA_KANJI_READINGS } from './ja-kanji-readings';

/** Longest key first matters: `kya` must beat `ky`, `ka`. */
const ROMAJI: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ',
  ta: 'た', ti: 'ち', chi: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wo: 'を',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ',
  sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ',
  tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ',
  jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ',
  zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
  va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
  we: 'うぇ', wi: 'うぃ',
  '-': 'ー', '.': '。', ',': '、', '?': '？', '!': '！',
};

const MAX_KEY = 3;
/** A vowel after `n` binds to it — `na`, never ん + あ. */
const VOWELS = 'aiueo';

/**
 * Convert as far as the buffer allows, leaving the undecided tail pending.
 *
 * Every rule here is one a system IME applies, and each is the reason a
 * learner's typing looks wrong without it:
 *   - a doubled consonant is the small tsu (`kitte` -> きって), not two kana;
 *   - `n` before a consonant is ん (`konnichiwa`, `ganbaru`), but `n` before a
 *     vowel or `y` is the start of な / にゃ and must wait;
 *   - anything the table cannot place is left alone rather than dropped, so a
 *     learner never watches characters vanish.
 */
export function romajiToKana(buffer: string, final = false): Conversion {
  const src = buffer.toLowerCase();
  let out = '';
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    // Small tsu: a consonant doubled before another kana.
    if (ch === next && ch !== 'n' && ch >= 'a' && ch <= 'z' && !VOWELS.includes(ch)) {
      out += 'っ';
      i += 1;
      continue;
    }

    // Syllabic n. A bare `n` only settles once the next character proves it is
    // not starting な-row or にゃ.
    //
    // Doubled `n` is the case that decides こんにちわ. The second n belongs to
    // the syllable AFTER the ん whenever a vowel follows it — konnichiwa is
    // ko-n-ni-chi-wa, onna is o-n-na — so only one n is consumed there. With
    // no vowel behind it, `nn` is just how ん is spelled out, and both go.
    if (ch === 'n' && next === 'n') {
      out += 'ん';
      const after = src[i + 2];
      i += after && (VOWELS.includes(after) || after === 'y') ? 1 : 2;
      continue;
    }
    if (ch === 'n' && next && !VOWELS.includes(next) && next !== 'y') {
      out += 'ん';
      i += 1;
      continue;
    }

    let matched = false;
    for (let len = Math.min(MAX_KEY, src.length - i); len >= 1; len--) {
      const kana = ROMAJI[src.slice(i, i + len)];
      if (kana) {
        out += kana;
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Not romaji at all — a space, a digit, kana the learner pasted. Keep it.
    if (!/[a-z]/.test(ch)) {
      out += ch;
      i += 1;
      continue;
    }

    // A consonant still waiting for its vowel.
    const tail = src.slice(i);
    if (!final) return { text: out, pending: tail };
    // Nothing more is coming: a lone trailing n is ん (nihon, mon, san), and
    // any other stranded consonant is left visible rather than deleted.
    return { text: out + (tail === 'n' ? 'ん' : tail), pending: '' };
  }

  return { text: out, pending: '' };
}

/**
 * Both indexes are built on FIRST USE, not at import.
 *
 * index.ts loads every engine so it can answer `scriptInputFor`, so a module
 * that parsed its table eagerly would make a Spanish learner pay to index
 * 6,472 kanji on the way to a text field they will type `hola` into. Neither
 * table is touched until someone asks for a Japanese candidate.
 */
let kanjiByReading: Map<string, string[]> | null = null;
function wordIndex(): Map<string, string[]> {
  if (kanjiByReading) return kanjiByReading;
  kanjiByReading = new Map(
    JA_LEXICON.split('\n')
      .filter(Boolean)
      .map((line) => {
        const [reading, spellings] = line.split('\t');
        return [reading, spellings.split('|')] as [string, string[]];
      }),
  );
  return kanjiByReading;
}

/** reading -> single kanji, the per-character fallback under the word list. */
let charsByReading: Map<string, string[]> | null = null;
function charIndex(): Map<string, string[]> {
  if (charsByReading) return charsByReading;
  const built = new Map<string, string[]>();
  for (const line of JA_KANJI_READINGS.split('\n')) {
    if (!line) continue;
    const [readingList, kanji] = line.split('\t');
    for (const reading of readingList.split('|')) {
      const bucket = built.get(reading);
      if (bucket) bucket.push(kanji);
      else built.set(reading, [kanji]);
    }
  }
  charsByReading = built;
  return charsByReading;
}

const MAX_CANDIDATES = 20;

/**
 * Kanji spellings for kana the learner has already typed.
 *
 * Matched on the kana, not on the romaji, because the learner converts after
 * the kana is on screen — the same order a system IME works in.
 *
 * Four tiers, in the order a learner wants them:
 *   1. the whole word they typed the reading of — さかな gives 魚;
 *   2. a single kanji with that exact reading — にゅう gives 乳, which is the
 *      only way to write a fill-blank fragment, since a fragment is in no
 *      dictionary;
 *   3. words the reading only starts;
 *   4. single kanji the reading only starts.
 *
 * `context` re-ranks across all four. It never adds.
 */
export function kanjiCandidates(kana: string, context: readonly string[]): Candidate[] {
  if (!kana) return [];

  const seen = new Set<string>();
  const tiers: Candidate[][] = [[], [], [], []];
  const push = (tier: number, text: string, reading: string) => {
    if (seen.has(text)) return;
    seen.add(text);
    tiers[tier].push({ text, reading });
  };

  const words = wordIndex();
  const chars = charIndex();
  for (const text of words.get(kana) ?? []) push(0, text, kana);
  for (const text of chars.get(kana) ?? []) push(1, text, kana);
  for (const [reading, spellings] of words) {
    if (reading === kana || !reading.startsWith(kana)) continue;
    for (const text of spellings) push(2, text, reading);
  }
  for (const [reading, spellings] of chars) {
    if (tiers[3].length >= MAX_CANDIDATES) break;
    if (reading === kana || !reading.startsWith(kana)) continue;
    for (const text of spellings) push(3, text, reading);
  }

  const wanted = new Set(context);
  return tiers
    .flatMap((tier, i) =>
      tier
        .sort((a, b) => {
          const rank = Number(wanted.has(b.text)) - Number(wanted.has(a.text));
          return rank || a.reading.length - b.reading.length;
        })
        .map((c) => ({ ...c, tier: i })),
    )
    .sort((a, b) => Number(wanted.has(b.text)) - Number(wanted.has(a.text)) || a.tier - b.tier)
    .slice(0, MAX_CANDIDATES)
    .map(({ text, reading }) => ({ text, reading }));
}

const HIRAGANA_ROWS: readonly (readonly string[])[] = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', 'ゆ', 'よ', 'わ', 'を'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['ん', 'っ', 'ゃ', 'ゅ', 'ょ'],
  ['が', 'ざ', 'だ', 'ば', 'ぱ'],
  ['、', '。', 'ー', '？', '！'],
];

const KATAKANA_ROWS: readonly (readonly string[])[] = [
  ['ア', 'イ', 'ウ', 'エ', 'オ'],
  ['カ', 'キ', 'ク', 'ケ', 'コ'],
  ['サ', 'シ', 'ス', 'セ', 'ソ'],
  ['タ', 'チ', 'ツ', 'テ', 'ト'],
  ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'],
  ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'],
  ['マ', 'ミ', 'ム', 'メ', 'モ'],
  ['ヤ', 'ユ', 'ヨ', 'ワ', 'ヲ'],
  ['ラ', 'リ', 'ル', 'レ', 'ロ'],
  ['ン', 'ッ', 'ャ', 'ュ', 'ョ'],
  ['ガ', 'ザ', 'ダ', 'バ', 'パ'],
  ['、', '。', 'ー', '？', '！'],
];

export const japaneseInput: ScriptInputEngine = {
  language: 'ja',
  romanization: 'romaji',
  hint: 'Type in romaji — konnichiwa becomes こんにちは. Tap a suggestion for kanji.',
  convert: (buffer) => romajiToKana(buffer),
  settle: (buffer) => romajiToKana(buffer, true).text,
  candidates: kanjiCandidates,
  keypad: HIRAGANA_ROWS,
  keypadPages: [
    { label: 'あ', rows: HIRAGANA_ROWS },
    { label: 'ア', rows: KATAKANA_ROWS },
  ],
};
