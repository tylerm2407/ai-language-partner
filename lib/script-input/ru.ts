/**
 * Russian input: Latin letters in, Cyrillic out.
 *
 * The mapping is the informal transliteration Russian speakers already use
 * when they are stuck on a Latin keyboard — `privet` -> привет, `zhena` ->
 * жена — rather than a standards-body romanisation. It is what a learner will
 * guess, and guessing right is the whole point.
 *
 * Six letters have no natural Latin spelling: ъ ь э and the digraph-only ж ч ш
 * щ when a learner does not know the digraph. All thirty-three are on the
 * keypad, so nothing is unreachable by someone who does not know the trick.
 */

import type { ScriptInputEngine, Conversion } from './types';

/** Longest match wins, so `shch` beats `sh` beats `s`. */
const TRANSLIT: Record<string, string> = {
  shch: 'щ', sch: 'щ',
  zh: 'ж', kh: 'х', ts: 'ц', ch: 'ч', sh: 'ш',
  yo: 'ё', yu: 'ю', ya: 'я', ye: 'е', eh: 'э',
  yy: 'ый',
  a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'е', z: 'з', i: 'и',
  j: 'й', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', r: 'р',
  s: 'с', t: 'т', u: 'у', f: 'ф', h: 'х', c: 'ц', y: 'ы',
  // `y` is positional, see YOD below; 'ы' is its value after a consonant.
  w: 'в', x: 'кс', q: 'к',
  "''": 'ъ', "'": 'ь',
};

const MAX_KEY = 4;
/** Cyrillic vowels, for deciding what a bare `y` means. */
const CYRILLIC_VOWELS = 'аеёиоуыэюя';
/** Every key long enough that a partial spelling of it must wait. */
const MULTI = Object.keys(TRANSLIT).filter((k) => k.length > 1);

function isPrefixOfKey(tail: string): boolean {
  return MULTI.some((key) => key !== tail && key.startsWith(tail));
}

/**
 * Convert as far as the buffer allows.
 *
 * The pending tail is what separates this from a find-and-replace: `s` alone
 * cannot be committed as с, because the next keystroke may make it ш or щ. It
 * is held back and shown as composition instead, and a learner who stops there
 * still gets с when the field is read.
 */
export function latinToCyrillic(buffer: string, final = false): Conversion {
  const src = buffer.toLowerCase();
  let out = '';
  let i = 0;

  while (i < src.length) {
    let matched = false;
    for (let len = Math.min(MAX_KEY, src.length - i); len >= 1; len--) {
      const slice = src.slice(i, i + len);
      const cyrillic = TRANSLIT[slice];
      if (!cyrillic) continue;
      // A complete key at the very end of the buffer may still grow into a
      // longer one: `s` is с, but the learner may be halfway through `shch`.
      if (!final && i + len === src.length && isPrefixOfKey(slice)) {
        return { text: out, pending: slice };
      }
      // A bare `y` is two different letters depending on where it lands:
      // ы after a consonant (yazyk -> язык) and й after a vowel (chay -> чай).
      // English has one letter for both jobs, so a learner will type one.
      const settled =
        slice === 'y' && CYRILLIC_VOWELS.includes(out.slice(-1)) ? 'й' : cyrillic;
      out += settled;
      i += len;
      matched = true;
      break;
    }
    if (matched) continue;

    const ch = src[i];
    if (/[a-z']/.test(ch)) {
      // A letter that starts a digraph but has no standalone meaning yet.
      if (!final && isPrefixOfKey(src.slice(i))) return { text: out, pending: src.slice(i) };
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }

  return { text: out, pending: '' };
}

const ROWS: readonly (readonly string[])[] = [
  ['а', 'б', 'в', 'г', 'д', 'е'],
  ['ё', 'ж', 'з', 'и', 'й', 'к'],
  ['л', 'м', 'н', 'о', 'п', 'р'],
  ['с', 'т', 'у', 'ф', 'х', 'ц'],
  ['ч', 'ш', 'щ', 'ъ', 'ы', 'ь'],
  ['э', 'ю', 'я', ',', '.', '?'],
];

export const russianInput: ScriptInputEngine = {
  language: 'ru',
  romanization: 'Latin letters',
  hint: 'Type it as it sounds: privet becomes привет',
  composing: /[A-Za-z'’ü-]+$/,
  convert: (buffer) => latinToCyrillic(buffer),
  settle: (buffer) => latinToCyrillic(buffer, true).text,
  candidates: () => [],
  keypad: ROWS,
};
