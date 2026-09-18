/**
 * Korean input: romaja in, composed Hangul syllables out.
 *
 * Hangul is alphabetic, so unlike Chinese and Japanese there is nothing to
 * choose from — every reading has exactly one spelling. What it does need is
 * COMPOSITION: ㅎ ㅏ ㄴ is not three characters, it is 한, one syllable block,
 * and the block is built arithmetically from the Unicode Hangul Syllables
 * range.
 *
 * The hard part is not the arithmetic, it is deciding whether a consonant
 * closes the syllable it follows or opens the next one. `hanguk` is 한국 (the
 * g opens 국) and `sarang` is 사랑 (the ng closes 랑), and the letters give no
 * clue — only what comes after them does. So the buffer is tokenised in full
 * before anything is composed, and each consonant looks ahead at the next
 * token before it takes a slot.
 */

import type { ScriptInputEngine, Conversion } from './types';

const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNGSEONG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
/** Index 0 is "no final consonant". */
const JONGSEONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

/** Romaja for a consonant OPENING a syllable (Revised Romanization). */
const INITIAL: Record<string, string> = {
  g: 'ㄱ', kk: 'ㄲ', n: 'ㄴ', d: 'ㄷ', tt: 'ㄸ', r: 'ㄹ', l: 'ㄹ', m: 'ㅁ',
  b: 'ㅂ', pp: 'ㅃ', s: 'ㅅ', ss: 'ㅆ', ng: 'ㅇ', j: 'ㅈ', jj: 'ㅉ',
  ch: 'ㅊ', k: 'ㅋ', t: 'ㅌ', p: 'ㅍ', h: 'ㅎ',
};

/**
 * Romaja for a consonant CLOSING a syllable. The same letter means a different
 * consonant here — final `k` is ㄱ, not ㅋ, which is why `hanguk` ends 국.
 */
const FINAL: Record<string, string> = {
  k: 'ㄱ', g: 'ㄱ', kk: 'ㄲ', n: 'ㄴ', t: 'ㄷ', d: 'ㄷ', l: 'ㄹ', r: 'ㄹ',
  m: 'ㅁ', p: 'ㅂ', b: 'ㅂ', s: 'ㅅ', ss: 'ㅆ', ng: 'ㅇ', j: 'ㅈ',
  ch: 'ㅊ', h: 'ㅎ',
};

const VOWEL: Record<string, string> = {
  a: 'ㅏ', ae: 'ㅐ', ya: 'ㅑ', yae: 'ㅒ', eo: 'ㅓ', e: 'ㅔ', yeo: 'ㅕ',
  ye: 'ㅖ', o: 'ㅗ', wa: 'ㅘ', wae: 'ㅙ', oe: 'ㅚ', yo: 'ㅛ', u: 'ㅜ',
  wo: 'ㅝ', we: 'ㅞ', wi: 'ㅟ', yu: 'ㅠ', eu: 'ㅡ', ui: 'ㅢ', i: 'ㅣ',
};

/** Finals that merge when a second consonant lands on a closed syllable. */
const COMPOUND_FINAL: Record<string, string> = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ',
  'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ',
  'ㅂㅅ': 'ㅄ',
};
/** Reversed, for when a compound final has to give its tail to the next block. */
const SPLIT_FINAL: Record<string, [string, string]> = Object.fromEntries(
  Object.entries(COMPOUND_FINAL).map(([pair, merged]) => [merged, [pair[0], pair[1]]]),
);

/** Vowels that merge on the keypad, where they are tapped one at a time. */
const COMPOUND_VOWEL: Record<string, string> = {
  'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ',
  'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ',
};

type Token = { kind: 'c' | 'v'; romaja: string } | { kind: 'raw'; romaja: string };

const KEYS = [...new Set([...Object.keys(INITIAL), ...Object.keys(FINAL), ...Object.keys(VOWEL)])]
  .sort((a, b) => b.length - a.length);
const MAX_KEY = KEYS[0].length;

function startsVowel(rest: string): boolean {
  for (let len = Math.min(3, rest.length); len >= 1; len--) {
    if (VOWEL[rest.slice(0, len)]) return true;
  }
  return false;
}

/** Split the buffer into consonant and vowel tokens; return the undecided tail. */
function tokenize(src: string): { tokens: Token[]; pending: string } {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    let matched = false;
    for (let len = Math.min(MAX_KEY, src.length - i); len >= 1; len--) {
      let slice = src.slice(i, i + len);
      if (!KEYS.includes(slice)) continue;
      // `ng` is one consonant in 사랑 and two in 안경 (an-gyeong). Only a
      // following vowel tells them apart: there, the g opens the next block.
      if (slice === 'ng' && startsVowel(src.slice(i + 2))) slice = 'n';
      if (VOWEL[slice]) tokens.push({ kind: 'v', romaja: slice });
      else tokens.push({ kind: 'c', romaja: slice });
      i += slice.length;
      matched = true;
      break;
    }
    if (matched) continue;

    const ch = src[i];
    if (/[a-z]/.test(ch)) return { tokens, pending: src.slice(i) };
    tokens.push({ kind: 'raw', romaja: ch });
    i += 1;
  }
  return { tokens, pending: '' };
}

interface Block { cho: string; jung: string; jong: string }

function render(b: Block): string {
  if (!b.cho && !b.jung) return '';
  if (!b.jung) return b.cho;
  const ci = CHOSEONG.indexOf(b.cho || 'ㅇ');
  const vi = JUNGSEONG.indexOf(b.jung);
  const fi = b.jong ? JONGSEONG.indexOf(b.jong) : 0;
  if (ci < 0 || vi < 0 || fi < 0) return (b.cho ?? '') + b.jung + (b.jong ?? '');
  return String.fromCodePoint(0xac00 + (ci * 21 + vi) * 28 + fi);
}

/**
 * Convert romaja to composed Hangul.
 *
 * An unfinished block is still real text — ㄱ and 가 are both things a learner
 * can see and mean — so only romaja that has not yet formed a jamo is held
 * back as pending.
 */
export function romajaToHangul(buffer: string): Conversion {
  const { tokens, pending } = tokenize(buffer.toLowerCase());
  let out = '';
  // Boxed rather than a bare `let`, because `flush` reassigns it from inside a
  // closure and TypeScript's control-flow analysis cannot see that happen —
  // it keeps narrowing the variable to the `null` it was initialised with.
  const state: { block: Block | null } = { block: null };

  const flush = () => {
    if (state.block) out += render(state.block);
    state.block = null;
  };

  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];
    const current = state.block;
    if (token.kind === 'raw') {
      flush();
      out += token.romaja;
      continue;
    }

    if (token.kind === 'v') {
      const vowel = VOWEL[token.romaja];
      if (!current || !current.jung) {
        // A vowel with nothing before it takes the silent initial ㅇ.
        state.block = { cho: current ? current.cho : 'ㅇ', jung: vowel, jong: '' };
        continue;
      }
      if (current.jong) {
        // The final was never a final: it opens this block instead.
        const split = SPLIT_FINAL[current.jong];
        const carried: string = split ? split[1] : current.jong;
        current.jong = split ? split[0] : '';
        flush();
        state.block = { cho: carried, jung: vowel, jong: '' };
        continue;
      }
      const merged = COMPOUND_VOWEL[current.jung + vowel];
      if (merged) {
        current.jung = merged;
        continue;
      }
      flush();
      state.block = { cho: 'ㅇ', jung: vowel, jong: '' };
      continue;
    }

    // Consonant.
    if (!current || !current.jung) {
      flush();
      state.block = { cho: INITIAL[token.romaja] ?? token.romaja, jung: '', jong: '' };
      continue;
    }
    // A consonant followed by a vowel opens the next block, never closes this
    // one — this is the `hanguk` / `sarang` split.
    const nextIsVowel = tokens[t + 1]?.kind === 'v';
    const asFinal = FINAL[token.romaja];
    if (nextIsVowel || !asFinal || JONGSEONG.indexOf(asFinal) < 0) {
      flush();
      state.block = { cho: INITIAL[token.romaja] ?? token.romaja, jung: '', jong: '' };
      continue;
    }
    if (!current.jong) {
      current.jong = asFinal;
      continue;
    }
    const merged = COMPOUND_FINAL[current.jong + asFinal];
    if (merged) {
      current.jong = merged;
      continue;
    }
    flush();
    state.block = { cho: INITIAL[token.romaja] ?? token.romaja, jung: '', jong: '' };
  }

  flush();
  return { text: out, pending };
}

const ROWS: readonly (readonly string[])[] = [
  ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ'],
  ['ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ'],
  ['ㅍ', 'ㅎ', 'ㄲ', 'ㄸ', 'ㅃ', 'ㅆ'],
  ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ'],
  ['ㅜ', 'ㅠ', 'ㅡ', 'ㅣ', 'ㅐ', 'ㅔ'],
  ['ㅚ', 'ㅟ', 'ㅢ', ',', '.', '?'],
];

export const koreanInput: ScriptInputEngine = {
  language: 'ko',
  romanization: 'romaja',
  hint: 'Type it the way it sounds — annyeong becomes 안녕, hanguk becomes 한국.',
  convert: romajaToHangul,
  // Romaja that formed no jamo is left as typed rather than dropped.
  settle: (buffer) => {
    const { text, pending } = romajaToHangul(buffer);
    return text + pending;
  },
  candidates: () => [],
  keypad: ROWS,
};
