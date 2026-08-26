// Narration script assembly for the news podcast.
//
// Pure functions only, no I/O — split out from index.ts so `deno test` can
// exercise them without a network or a service-role key, following the
// score-pronunciation/scoring.ts precedent.
//
// ── Why there is no content-safety pass anywhere in this function ──
//
// The script is built ONLY from a persisted `daily_news` row, and that row
// already went through generateValidated's safety + CEFR pipeline when
// daily-news-cron wrote it. Narrating stored text introduces no new model
// output, so re-running the pipeline would re-validate text that is already
// validated and bill for the privilege.
//
// That guarantee holds exactly as long as the input keeps coming from the
// row. NEVER build a narration script from a request body, a URL, or
// anything a caller supplies — the moment unvalidated text can reach the
// synthesiser, this function is bypassing CLAUDE.md §1.1.

/** Single-pass synthesis cap.
 *
 *  Sized from observation, not guesswork: across 2,262 prod `daily_news`
 *  rows spanning 126 days, `content` never exceeded 1,693 characters and
 *  title+summary+content peaked at 2,096. 3,000 covers the observed p100
 *  with ~40% headroom, so `splitForSynthesis` returns a single chunk for
 *  every article we have ever produced. */
export const MAX_NEWS_SCRIPT_CHARS = 3000;

/** Hard reject. Beyond this something has gone wrong upstream — a prompt
 *  change, a model that ignored its word budget, a corrupted row — and
 *  quietly synthesising 6,000+ characters is a bill nobody authorised. */
export const MAX_NEWS_TOTAL_CHARS = 6000;

/** Inserted between the title, the summary and the body.
 *
 *  A blank line is the provider-agnostic way to ask for a beat: both
 *  ElevenLabs and fish.audio treat a paragraph break as a longer pause than
 *  a sentence break, and neither pronounces it. SSML would be neither
 *  (fish.audio's /v1/tts takes plain text only). */
const SECTION_BREAK = '\n\n';

/** Terminal punctuation across the scripts we teach — Latin, Cyrillic and
 *  CJK all appear in `daily_news`. Mirrors `asCitationForm` in
 *  ../tts/synthesis.ts, for the same reason: text with no terminal
 *  punctuation leaves the model guessing at the intonation contour, and a
 *  headline read with a trailing rise sounds like a question. */
const TERMINAL_PUNCTUATION = /[.!?…。！？]$/;

/** Sentence-final punctuation followed by whitespace, or a CJK full stop
 *  (which is not followed by a space). Used only by the dormant splitter. */
const SENTENCE_BOUNDARY = /(?<=[.!?…])\s+|(?<=[。！？])/;

export interface NarrationSource {
  title: string;
  summary: string;
  content: string;
}

/** Strip the markdown emphasis the text model sometimes emits despite being
 *  asked for plain prose. `tts/index.ts` does the same thing at the same
 *  point in its pipeline — unstripped, `**` is read aloud as "asterisk
 *  asterisk" by ElevenLabs and as a glottal stutter by fish. */
function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, '').trim();
}

/** Give a section a terminal stop so the next one does not run into it. */
function asSentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return '';
  return TERMINAL_PUNCTUATION.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Assemble the spoken script: headline, beat, summary, beat, body.
 *
 * The summary is included even though it paraphrases the body. For a
 * *listener* that repetition is the feature — a podcast has no headline to
 * glance back at, so hearing the gist before the detail is what makes a
 * 250-word article in a foreign language followable at all.
 *
 * Empty sections are dropped rather than emitted as stray punctuation, so a
 * row with a missing summary narrates as title + body instead of an audible
 * hiccup.
 */
export function buildNarrationScript(source: NarrationSource): string {
  return [source.title, source.summary, source.content]
    .map((section) => asSentence(stripMarkdown(section ?? '')))
    .filter((section) => section.length > 0)
    .join(SECTION_BREAK);
}

/**
 * Split a script into synthesis-sized chunks.
 *
 * DORMANT BY DESIGN. Every article ever produced fits in one chunk (see
 * MAX_NEWS_SCRIPT_CHARS), so in practice this returns `[script]` and the
 * caller does a single synthesis pass. It exists because the 3,000-char
 * ceiling rests on 126 days of *observed* model behaviour — `max_tokens`
 * on daily-news-cron is 1,800, which bounds tokens, not characters — and a
 * prompt tweak upstream could push an article past it without warning.
 *
 * When it does engage, the caller MUST log loudly (see `didSplit`): the
 * event means the single-pass assumption has expired and the multi-chunk
 * path — which stitches separately-synthesised MP3s and can be audible at
 * the seams — is now live in production.
 *
 * Splits on paragraph boundaries first, then sentences, then (last resort)
 * a hard character cut. Never returns an empty array, never returns a chunk
 * over the cap.
 */
export function splitForSynthesis(
  script: string,
  maxChars: number = MAX_NEWS_SCRIPT_CHARS,
): string[] {
  const trimmed = script.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  // Paragraphs, then sentences within any paragraph still too long, then a
  // blunt slice for the pathological case (a 3,000-character sentence).
  const paragraphs = trimmed.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const pieces: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      pieces.push(paragraph);
      continue;
    }
    for (const sentence of paragraph.split(SENTENCE_BOUNDARY)) {
      const s = sentence.trim();
      if (s.length === 0) continue;
      if (s.length <= maxChars) {
        pieces.push(s);
      } else {
        for (let i = 0; i < s.length; i += maxChars) pieces.push(s.slice(i, i + maxChars));
      }
    }
  }

  // Re-pack: greedy merge so we make the fewest provider calls, which is
  // both cheaper and — because every seam is a potential audible join —
  // better sounding.
  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    const candidate = current.length === 0 ? piece : `${current}${SECTION_BREAK}${piece}`;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current.length > 0) chunks.push(current);
      current = piece;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** True when `splitForSynthesis` produced more than one chunk — i.e. the
 *  single-pass assumption has just expired and the caller should log it. */
export function didSplit(chunks: string[]): boolean {
  return chunks.length > 1;
}

/** Characters per second of narration, by script.
 *
 *  Two rates because the character is not a constant unit of speech: a CJK
 *  character is a whole syllable (often a whole morpheme), while a Latin or
 *  Cyrillic character is a fraction of one. Reading a Japanese article and a
 *  Spanish article at the same characters-per-second would put the estimate
 *  out by a factor of three.
 *
 *  These are estimates used only to populate `audio_duration_ms` when the
 *  real MP3 header cannot be parsed — the player prefers the measured value.
 */
const CJK_CHARS_PER_SECOND = 4.5;
const LATIN_CHARS_PER_SECOND = 14;

/** CJK ideographs, kana, and Hangul — the scripts where one character is
 *  roughly one syllable. */
const CJK_RANGE =
  /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/;

/**
 * Estimate spoken duration in milliseconds.
 *
 * Mixed-script text is handled by counting each class separately rather
 * than picking one rate for the whole string, so a Japanese article quoting
 * an English company name does not skew.
 *
 * This is a fallback, not a measurement: `parseMp3DurationMs` reads the real
 * value out of the rendered file, and callers should prefer it. Returns 0
 * for empty input.
 */
export function estimateDurationMs(script: string): number {
  let cjk = 0;
  let other = 0;
  for (const char of script) {
    if (/\s/.test(char)) continue;
    if (CJK_RANGE.test(char)) cjk += 1;
    else other += 1;
  }
  const seconds = cjk / CJK_CHARS_PER_SECOND + other / LATIN_CHARS_PER_SECOND;
  return Math.round(seconds * 1000);
}
