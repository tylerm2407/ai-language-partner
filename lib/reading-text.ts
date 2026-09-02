/**
 * Turning a book's raw text into something a reader can tap.
 *
 * Pure and RN-free so it can be unit tested (see reading-text.test.ts).
 *
 * The load-bearing idea is PARAGRAPHS. The reader used to slice `content`
 * every `1200 * (16 / fontSize)` characters, which meant the boundaries of a
 * chunk of text moved when the learner changed the font size. That was fine
 * while nothing referred to a chunk by name; it stops being fine the moment a
 * paragraph is a thing you can ask about, because the explanation cache is
 * keyed on a hash of the paragraph and a font-size-dependent hash is a cache
 * that never hits. Paragraphs are also how the text was written, so they
 * render better than a hard cut mid-sentence.
 *
 * A page is then a run of whole paragraphs. Position is still a character
 * offset into `content`, which is what `user_book_progress.current_position`
 * has always stored — so this changes how a book is laid out without
 * invalidating where anyone had got to.
 */

/**
 * Imported Gutenberg text separates paragraphs with a blank line and is hard
 * wrapped at ~70 characters inside them, using CRLF. Matching `\r?\n` twice
 * with anything between covers CRLF, LF, and the runs of blank lines the
 * importer leaves around headings.
 */
const PARAGRAPH_BREAK = /\r?\n[ \t]*\r?\n\s*/;

/**
 * Paragraphs shorter than this are merged forward into the next one.
 *
 * Verse, drama and dialogue-heavy books come out of Gutenberg with one line
 * per paragraph — a 25-book production sample had Italian titles averaging 58
 * characters per paragraph, against 169–1025 for prose. A single line of verse
 * is not something anyone wants explained on its own, and it would make the
 * reader a wall of tap targets.
 *
 * 60 sits in that gap: it sweeps up verse lines and one-line dialogue while
 * leaving even the shortest real prose paragraph alone.
 */
export const MIN_PARAGRAPH_CHARS = 60;

/**
 * Merging stops once a block would exceed this, so blocks stay explainable and
 * a genuinely long paragraph is never glued onto a preceding stray line.
 */
export const MAX_MERGED_PARAGRAPH_CHARS = 400;

export interface Paragraph {
  /** Index into the returned array. Stable for a given `content`. */
  index: number;
  /** Character offset of this paragraph's first character within `content`. */
  offset: number;
  /** The paragraph's text, with its internal hard wrapping left alone. */
  text: string;
}

export interface Page {
  index: number;
  paragraphs: Paragraph[];
  /** Offset of the first character of the first paragraph on this page. */
  offset: number;
}

export interface Token {
  raw: string;
  isSpace: boolean;
  /** Offset within the paragraph, not within the book. */
  start: number;
  end: number;
}

/**
 * Split `content` into paragraphs, merging runs of very short ones.
 *
 * Offsets are computed against the ORIGINAL string, so a paragraph's `offset`
 * is directly comparable with a stored `current_position`.
 */
export function splitParagraphs(content: string): Paragraph[] {
  if (!content) return [];

  const raw: { offset: number; text: string }[] = [];
  let cursor = 0;
  for (const chunk of content.split(PARAGRAPH_BREAK)) {
    // `indexOf` from the cursor rather than arithmetic on lengths: the
    // separator is variable-width (CRLF vs LF, extra blank lines), so adding
    // up chunk lengths would drift.
    const at = chunk ? content.indexOf(chunk, cursor) : cursor;
    const text = chunk.trim();
    if (text) {
      const offset = at + chunk.indexOf(text);
      raw.push({ offset, text });
    }
    cursor = at + chunk.length;
  }

  const merged: Paragraph[] = [];
  for (const p of raw) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.text.length < MIN_PARAGRAPH_CHARS &&
      last.text.length + p.text.length <= MAX_MERGED_PARAGRAPH_CHARS
    ) {
      // Join with a newline, not a space: these were separate lines and a
      // stanza read as one run-on line is worse than one that keeps its shape.
      last.text = `${last.text}\n${p.text}`;
      continue;
    }
    merged.push({ index: merged.length, offset: p.offset, text: p.text });
  }

  return merged;
}

/**
 * Pack whole paragraphs into pages of roughly `charBudget` characters.
 *
 * A paragraph longer than the budget gets a page of its own rather than being
 * cut — its identity has to survive for the explanation cache, and one long
 * paragraph that scrolls is a better read than one severed mid-clause.
 */
export function paginateParagraphs(paragraphs: Paragraph[], charBudget: number): Page[] {
  const budget = Math.max(1, Math.floor(charBudget));
  const pages: Page[] = [];
  let current: Paragraph[] = [];
  let used = 0;

  const flush = () => {
    if (current.length === 0) return;
    pages.push({ index: pages.length, paragraphs: current, offset: current[0].offset });
    current = [];
    used = 0;
  };

  for (const p of paragraphs) {
    if (current.length > 0 && used + p.text.length > budget) flush();
    current.push(p);
    used += p.text.length;
    if (used >= budget) flush();
  }
  flush();

  return pages;
}

/**
 * Which page contains a stored character offset.
 *
 * Returns 0 for an offset before the first page and the last page for one past
 * the end — a reader whose saved position no longer exists (the book was
 * re-imported shorter) lands somewhere sensible rather than on a blank screen.
 */
export function pageForOffset(pages: Page[], offset: number): number {
  if (pages.length === 0) return 0;
  let found = 0;
  for (const page of pages) {
    if (page.offset <= offset) found = page.index;
    else break;
  }
  return found;
}

/**
 * Split a paragraph into word and whitespace tokens.
 *
 * Whitespace is kept as tokens rather than dropped so the rendered text
 * preserves the original spacing exactly — the reader re-joins these in order
 * and the result must be the paragraph it started with.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let start = 0;
  for (const raw of text.split(/(\s+)/)) {
    if (raw) {
      tokens.push({ raw, isSpace: /^\s+$/.test(raw), start, end: start + raw.length });
    }
    start += raw.length;
  }
  return tokens;
}

/**
 * The form of a word used for lookups and for cache keys.
 *
 * Strips surrounding punctuation and lowercases. Note that only LEADING and
 * TRAILING punctuation goes: `l'homme`, `sans-culotte` and `qu'est-ce` keep
 * their internal marks, because those are part of the word and a translator
 * given `l homme` would guess.
 */
export function normalizeWord(raw: string): string {
  return raw
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '')
    .toLowerCase();
}

/**
 * Every distinct word form in a stretch of text, normalised.
 *
 * Deliberately built from the same `tokenize` + `normalizeWord` the reader
 * uses, and exported for the corpus vocabulary build (scripts/build-book-vocab.ts)
 * and the coverage ranking. Those three MUST agree: the terms stored per book
 * are matched against the learner's known words by exact string, so a
 * tokenizer that differs by one rule — keeping a trailing apostrophe, say —
 * silently drops the intersection to near zero and the ranking degrades to
 * noise without erroring.
 */
export function wordTokens(text: string): string[] {
  const out: string[] = [];
  for (const token of tokenize(text)) {
    if (token.isSpace) continue;
    const word = normalizeWord(token.raw);
    if (word) out.push(word);
  }
  return out;
}
