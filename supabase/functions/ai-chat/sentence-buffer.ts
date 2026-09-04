/**
 * Where to cut a reply that is still being written, so each piece can be
 * safety-checked and spoken while the rest generates.
 *
 * The unit is a sentence, not a token or a fixed number of characters, for two
 * reasons. Safety: `validateContentSafety` matches whole words, so it needs
 * text with word boundaries in it, not a fragment ending mid-word. Prosody: a
 * synthesiser handed "Buenas tar" says something that is not a word, and the
 * seam between two clips is audible unless it falls where a speaker would
 * already have paused.
 *
 * The governing bias is stated once and applied everywhere below: PREFER
 * FLUSHING LATE. A sentence held one chunk too long costs a fraction of a
 * second nobody notices. A sentence cut in the wrong place is heard, and it is
 * heard as the product being broken — "Sr." spoken as a complete utterance,
 * "3." and "14" as two.
 *
 * Pure: no Deno APIs, no network, no I/O. See ./sentence-buffer.test.ts.
 */

/** Sentence-final punctuation in the Latin-script target languages. */
const LATIN_TERMINATORS = new Set(['.', '!', '?']);

/**
 * Sentence-final punctuation in the CJK target languages (ja/ko/zh).
 *
 * Held separately because the rule that follows a Latin terminator — "only
 * ends a sentence if whitespace follows" — is exactly wrong here: CJK does not
 * space its words, so `。` is followed immediately by the next sentence and
 * waiting for a space would mean never flushing until the stream ended.
 */
const CJK_TERMINATORS = new Set(['。', '！', '？']);

/** Punctuation that belongs to the sentence it closes, not to the next one. */
const CLOSERS = new Set(['"', "'", '»', '”', '’', ')', ']', '』', '」', '）', '›']);

/**
 * Tokens that end in a period without ending a sentence.
 *
 * Deliberately over-inclusive across en/es/fr/de/it/pt: a false entry here
 * costs one late flush, a missing entry costs a wrongly split sentence, and
 * the two are not the same size of mistake.
 */
const ABBREVIATIONS = new Set([
  // English
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'jr', 'sr', 'vs', 'etc', 'eg', 'ie',
  'approx', 'dept', 'univ', 'no', 'fig', 'al',
  // Spanish / Portuguese
  'sra', 'srta', 'ud', 'uds', 'ej', 'av', 'pág', 'pag', 'núm', 'num', 'ss',
  // French
  'mme', 'mlle', 'bd', 'env', 'cf', 'ca',
  // German
  'bzw', 'ggf', 'usw', 'ca', 'hr', 'nr', 'abb', 'evtl', 'inkl', 'zzgl',
  // Italian
  'sig', 'dott', 'ecc', 'egr', 'gent',
]);

function isSpace(ch: string): boolean {
  return /\s/.test(ch);
}

/** Letters and digits, in any script — what a "token" is made of. */
function isWordChar(ch: string): boolean {
  return /[\p{L}\p{N}]/u.test(ch);
}

/**
 * Is the period at `dotIndex` part of an abbreviation, an initial, or a
 * number rather than the end of a sentence?
 *
 * Only periods can be: nothing legitimately ends in `!` or `?` mid-sentence.
 */
function endsAbbreviation(buffer: string, dotIndex: number, sentenceStart: number): boolean {
  if (buffer[dotIndex] !== '.') return false;
  let tokenStart = dotIndex;
  while (tokenStart > 0 && isWordChar(buffer[tokenStart - 1])) tokenStart--;
  const token = buffer.slice(tokenStart, dotIndex);
  if (!token) return false;
  // A single letter is an initial or a German/Spanish abbreviation half:
  // "J. K. Rowling", "z. B.", "p. ej.". None of them ends a sentence.
  if (token.length === 1 && /\p{L}/u.test(token)) return true;
  if (/^\p{N}+$/u.test(token)) {
    // A bare number before a period is a list marker ("1. Primero") only when
    // it OPENS the sentence. Anywhere else it is the tail of a figure that
    // genuinely ends one — "Son 12.50." — and blocking that split would hold
    // the whole reply back to the end of the stream. ("3.14" mid-sentence is
    // already handled by the whitespace rule above; a digit follows the dot.)
    return tokenStart === sentenceStart || buffer[tokenStart - 1] === '\n';
  }
  return ABBREVIATIONS.has(token.toLowerCase());
}

export interface SentenceSplit {
  /** Complete sentences, in order, safe to emit. */
  sentences: string[];
  /** What is left over. Concatenating `sentences` and `rest` reproduces the
   *  input exactly — no character is dropped or duplicated at a seam. */
  rest: string;
}

/**
 * Split off every sentence the buffer can prove is complete.
 *
 * "Prove" is the operative word. A terminator alone is not proof — the
 * character after it is what distinguishes an ending from a decimal point or
 * an abbreviation, and if that character has not arrived yet the answer is
 * "not yet", never a guess.
 */
export function splitCompleteSentences(buffer: string): SentenceSplit {
  const sentences: string[] = [];
  let start = 0;
  let i = 0;

  while (i < buffer.length) {
    const ch = buffer[i];
    const cjk = CJK_TERMINATORS.has(ch);
    if (!cjk && !LATIN_TERMINATORS.has(ch)) {
      i++;
      continue;
    }

    // Swallow a run of terminators and closing punctuation so "?!" and
    // `dijo "hola".` come out as one sentence rather than several empty ones.
    let end = i + 1;
    while (
      end < buffer.length &&
      (LATIN_TERMINATORS.has(buffer[end]) || CJK_TERMINATORS.has(buffer[end]) || CLOSERS.has(buffer[end]))
    ) {
      end++;
    }

    if (!cjk) {
      // The character after the terminator is the evidence. Without it we
      // cannot tell "3.14" or "Sr. García" from an ending, so we stop and wait
      // for the next chunk rather than guess.
      if (end >= buffer.length) break;
      if (!isSpace(buffer[end])) {
        i = end;
        continue;
      }
      if (endsAbbreviation(buffer, i, start)) {
        i = end;
        continue;
      }
    }

    // Trailing whitespace rides with the sentence that precedes it, so the
    // pieces concatenate back into the original text and the next sentence
    // does not start with a space the synthesiser has to interpret.
    let after = end;
    while (after < buffer.length && isSpace(buffer[after])) after++;

    sentences.push(buffer.slice(start, after));
    start = after;
    i = after;
  }

  return { sentences, rest: buffer.slice(start) };
}
