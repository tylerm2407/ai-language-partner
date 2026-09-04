/**
 * Cutting a growing reply into sentences that can be spoken one at a time.
 *
 * The streaming turn exists so the learner hears sentence one while the model
 * is still writing sentence three. That only works if we can tell where a
 * sentence ends from a prefix of the text — we never get to look ahead.
 *
 * WHAT GOES WRONG IF THIS IS NAIVE
 *
 *   1. Splitting on every `.` sends "Son las 3." and "30 de la tarde." to TTS
 *      as two utterances, which is audibly wrong — the pause lands mid-number.
 *      Same for "Sr. García" and initials.
 *   2. Splitting on a terminator at the very end of the buffer is a guess: the
 *      next chunk may continue the token. A sentence is only closed once we
 *      have seen whitespace AFTER the terminator, so the decision is never made
 *      on incomplete evidence. Whatever is left over is flushed at end of turn.
 *
 * The server currently emits one sentence per `chunk` event, so most of the
 * time this passes text straight through. It is here because that is a server
 * detail, not a contract: a chunk that arrives as half a sentence, or as three,
 * still produces correctly ordered utterances.
 *
 * Pure and allocation-light — no timers, no I/O — so `sentence-stream.test.ts`
 * covers it without a device.
 */

/** Sentence-final punctuation across the languages the tutor speaks. */
const TERMINATORS = new Set(['.', '!', '?', '…', '。', '！', '？', '؟', '।']);

/**
 * Terminators that close a sentence on their own, with no whitespace after.
 *
 * CJK is written without spaces between sentences, so the "wait for whitespace"
 * rule below would never fire and a Japanese reply would arrive as one
 * unbroken utterance. These characters are also unambiguous — unlike `.`, they
 * appear in no abbreviation and no number — so there is nothing to wait for.
 */
const HARD_TERMINATORS = new Set(['。', '！', '？', '…', '।']);

/** Closers that may sit between the terminator and the whitespace. */
const CLOSERS = new Set(['"', "'", '»', '”', '’', ')', ']', '}', '›']);

/**
 * Tokens that end in `.` without ending a sentence.
 *
 * Deliberately short, and deliberately excludes anything that is also an
 * ordinary word — Spanish "No." abbreviates *número*, but "Creo que no." is a
 * far more common sentence than any use of the abbreviation, and blocking that
 * break would leave two sentences glued into one utterance. A missed
 * abbreviation costs one extra pause; a wrong entry costs a wrong pause on
 * every turn.
 */
const ABBREVIATIONS = new Set([
  'sr', 'sra', 'srta', 'dr', 'dra', 'ud', 'uds', 'etc', 'ej', 'núm',
  'mr', 'mrs', 'ms', 'st', 'vs', 'jr',
  'mme', 'mlle', 'herr', 'frau', 'sig', 'prof',
]);

export interface SentenceSplit {
  /** Complete sentences, in order, trimmed. */
  sentences: string[];
  /** Text after the last complete sentence. Feed it back in with the next chunk. */
  rest: string;
}

/**
 * Split `buffer` into the sentences we are sure about, plus the remainder.
 *
 * "Sure about" means: a terminator, optional closing punctuation, then
 * whitespace. A Latin terminator at the end of the buffer is left in `rest` —
 * it may be an abbreviation, a decimal point, or simply mid-token. The CJK
 * terminators do not wait, because nothing about them is ambiguous.
 */
export function splitSentences(buffer: string): SentenceSplit {
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < buffer.length; i++) {
    if (!TERMINATORS.has(buffer[i])) continue;

    let end = i + 1;
    while (end < buffer.length && CLOSERS.has(buffer[end])) end++;

    const hard = HARD_TERMINATORS.has(buffer[i]);
    if (!hard) {
      // Nothing after the terminator yet: we cannot tell a sentence end from a
      // token that is still arriving. Wait for more.
      if (end >= buffer.length) break;
      if (!/\s/.test(buffer[end])) continue;
      if (buffer[i] === '.' && !endsSentence(buffer, i)) continue;
    }

    const sentence = buffer.slice(start, end).trim();
    if (sentence.length > 0) sentences.push(sentence);
    // Step over the whitespace that separated the sentences, so `rest` starts
    // at real text — the caller renders it and hands it to TTS.
    start = end;
    while (start < buffer.length && /\s/.test(buffer[start])) start++;
    i = start - 1;
  }

  return { sentences, rest: buffer.slice(start) };
}

/**
 * Does the `.` at `index` actually end a sentence?
 *
 * Only `.` is ambiguous — `!`, `?` and the CJK terminators are not used inside
 * words or numbers.
 */
function endsSentence(buffer: string, index: number): boolean {
  // "3.30", "1.5 km" — a digit either side of the dot is a number, not a stop.
  const next = buffer[index + 1];
  if (/\d/.test(buffer[index - 1] ?? '') && /\d/.test(next ?? '')) return false;

  // Walk back over the word attached to the dot.
  let wordStart = index;
  while (wordStart > 0 && /[^\s]/.test(buffer[wordStart - 1])) wordStart--;
  const word = buffer.slice(wordStart, index).toLowerCase();

  // A single letter is an initial ("J. R. R."), not a sentence.
  if (word.length === 1 && /\p{L}/u.test(word)) return false;
  return !ABBREVIATIONS.has(word);
}

/**
 * Accumulating splitter for a stream of chunks.
 *
 * `push` returns whatever became complete because of that chunk — usually zero
 * or one sentence. `flush` returns the tail at end of turn: the model's last
 * sentence often has no trailing whitespace, so without this the learner would
 * never hear it.
 */
export function createSentenceStream(): {
  push(chunk: string): string[];
  flush(): string[];
  /** Everything pushed so far, complete or not. The text to render on screen. */
  text(): string;
} {
  let buffer = '';
  let full = '';

  return {
    push(chunk: string): string[] {
      full += chunk;
      buffer += chunk;
      const { sentences, rest } = splitSentences(buffer);
      buffer = rest;
      return sentences;
    },
    flush(): string[] {
      const tail = buffer.trim();
      buffer = '';
      return tail.length > 0 ? [tail] : [];
    },
    text(): string {
      return full;
    },
  };
}
