import {
  MAX_MERGED_PARAGRAPH_CHARS,
  MIN_PARAGRAPH_CHARS,
  normalizeWord,
  pageForOffset,
  paginateParagraphs,
  splitParagraphs,
  tokenize,
} from './reading-text';

// Imported Gutenberg text is CRLF, hard wrapped at ~70 chars inside a
// paragraph and separated by a blank line. Verified against 25 books in
// production on 2026-09-01: every one of them uses \r\n\r\n.
const GUTENBERG = [
  'Il y avait une fois un roi qui régnait sur un pays très lointain,',
  'et ce roi avait trois filles.',
  '',
  'La plus jeune était la plus belle.',
].join('\r\n');

describe('splitParagraphs', () => {
  it('splits on a blank line and keeps hard wrapping inside a paragraph', () => {
    const paras = splitParagraphs(GUTENBERG);
    expect(paras[0].text).toContain('\r\n');
    expect(paras[0].text.startsWith('Il y avait')).toBe(true);
  });

  it('offsets point at where the block starts in the original string', () => {
    // Comparable with a stored user_book_progress.current_position, which is
    // why the layout can change without invalidating where anyone had got to.
    const paras = splitParagraphs(GUTENBERG);
    for (const p of paras) {
      const firstLine = p.text.split('\n')[0];
      expect(GUTENBERG.startsWith(firstLine, p.offset)).toBe(true);
    }
  });

  it('handles LF-only text as well as CRLF', () => {
    const para = (c: string) => c.repeat(MIN_PARAGRAPH_CHARS + 5);
    const paras = splitParagraphs([para('a'), para('b'), para('c')].join('\n\n'));
    expect(paras).toHaveLength(3);
  });

  it('collapses runs of blank lines around headings into one break', () => {
    // The importer leaves several blank lines around title pages. Both of
    // these are short, so they also merge — which is the point: a title page
    // becomes one block rather than nine tap targets.
    const paras = splitParagraphs('ALBERT DURER\r\n\r\n\r\n\r\n\r\nA VENISE');
    expect(paras).toHaveLength(1);
    expect(paras[0].text).toBe('ALBERT DURER\nA VENISE');
  });

  it('merges consecutive short lines so verse is not one tap target per line', () => {
    // Drama and poetry come out of Gutenberg one line per paragraph.
    const verse = ['Ô temps, suspends ton vol !', 'Et vous, heures propices,', 'Suspendez votre cours.']
      .join('\r\n\r\n');
    const paras = splitParagraphs(verse);
    expect(paras).toHaveLength(1);
    expect(paras[0].text.split('\n')).toHaveLength(3);
  });

  it('stops merging once the block is long enough to be worth explaining', () => {
    const line = 'a'.repeat(MIN_PARAGRAPH_CHARS - 1);
    const paras = splitParagraphs(Array(6).fill(line).join('\r\n\r\n'));
    for (const p of paras) {
      expect(p.text.length).toBeLessThanOrEqual(MAX_MERGED_PARAGRAPH_CHARS);
    }
    expect(paras.length).toBeGreaterThan(1);
  });

  it('never merges when the block before it is already long enough', () => {
    const long = 'b'.repeat(MIN_PARAGRAPH_CHARS + 10);
    const paras = splitParagraphs([long, long, long].join('\r\n\r\n'));
    expect(paras.map((p) => p.text)).toEqual([long, long, long]);
  });

  it('never glues a long paragraph onto a preceding stray line', () => {
    const long = 'b'.repeat(MAX_MERGED_PARAGRAPH_CHARS);
    const paras = splitParagraphs(['« Oui. »', long].join('\r\n\r\n'));
    expect(paras).toHaveLength(2);
    expect(paras[1].text).toBe(long);
  });

  it('a real prose paragraph is left alone next to a short one', () => {
    const paras = splitParagraphs(GUTENBERG);
    expect(paras).toHaveLength(2);
    expect(paras[0].text).toContain('\r\n');
    expect(paras[1].text).toBe('La plus jeune était la plus belle.');
  });

  it('indexes are contiguous from zero', () => {
    const para = (c: string) => c.repeat(MIN_PARAGRAPH_CHARS + 5);
    const paras = splitParagraphs([para('a'), para('b'), para('c')].join('\n\n'));
    expect(paras.map((p) => p.index)).toEqual([0, 1, 2]);
  });

  it('empty content yields no paragraphs', () => {
    expect(splitParagraphs('')).toEqual([]);
    expect(splitParagraphs('\r\n\r\n   \r\n\r\n')).toEqual([]);
  });
});

describe('paginateParagraphs', () => {
  const paras = splitParagraphs(Array(10).fill('x'.repeat(200)).join('\n\n'));

  it('packs whole paragraphs and never splits one', () => {
    const pages = paginateParagraphs(paras, 500);
    const seen = pages.flatMap((p) => p.paragraphs.map((q) => q.index));
    expect(seen).toEqual(paras.map((p) => p.index));
  });

  it('page offsets are the first paragraph offset and increase', () => {
    const pages = paginateParagraphs(paras, 500);
    for (const page of pages) {
      expect(page.offset).toBe(page.paragraphs[0].offset);
    }
    const offsets = pages.map((p) => p.offset);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });

  it('a paragraph longer than the budget gets a page rather than a cut', () => {
    const huge = splitParagraphs('y'.repeat(5000));
    const pages = paginateParagraphs(huge, 1200);
    expect(pages).toHaveLength(1);
    expect(pages[0].paragraphs[0].text).toHaveLength(5000);
  });

  it('no content yields no pages', () => {
    expect(paginateParagraphs([], 1200)).toEqual([]);
  });
});

describe('pageForOffset', () => {
  const paras = splitParagraphs(Array(10).fill('z'.repeat(200)).join('\n\n'));
  const pages = paginateParagraphs(paras, 500);

  it('round-trips a page offset back to that page', () => {
    for (const page of pages) {
      expect(pageForOffset(pages, page.offset)).toBe(page.index);
    }
  });

  it('an offset inside a page resolves to that page', () => {
    const second = pages[1];
    expect(pageForOffset(pages, second.offset + 10)).toBe(second.index);
  });

  it('a stale offset past the end lands on the last page, not a blank screen', () => {
    expect(pageForOffset(pages, 10_000_000)).toBe(pages[pages.length - 1].index);
  });

  it('a negative or zero offset lands on the first page', () => {
    expect(pageForOffset(pages, -5)).toBe(0);
    expect(pageForOffset([], 42)).toBe(0);
  });
});

describe('tokenize', () => {
  it('preserves the text exactly when re-joined', () => {
    const text = 'Il y  avait\r\nune fois — un roi.';
    expect(tokenize(text).map((t) => t.raw).join('')).toBe(text);
  });

  it('marks whitespace runs, including newlines, as space tokens', () => {
    const tokens = tokenize('a\r\nb  c');
    expect(tokens.filter((t) => t.isSpace).map((t) => t.raw)).toEqual(['\r\n', '  ']);
  });

  it('offsets index back into the paragraph', () => {
    const text = 'une fois un roi';
    for (const t of tokenize(text)) {
      expect(text.slice(t.start, t.end)).toBe(t.raw);
    }
  });

  it('empty text yields no tokens', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('normalizeWord', () => {
  it('strips surrounding punctuation and lowercases', () => {
    expect(normalizeWord('«Roi»,')).toBe('roi');
    expect(normalizeWord('roi.')).toBe('roi');
    expect(normalizeWord('¿Qué?')).toBe('qué');
  });

  it('keeps internal apostrophes and hyphens — they are part of the word', () => {
    // A translator handed `l homme` would guess; handed `l'homme` it would not.
    expect(normalizeWord("l'homme,")).toBe("l'homme");
    expect(normalizeWord('sans-culotte!')).toBe('sans-culotte');
    expect(normalizeWord("qu'est-ce")).toBe("qu'est-ce");
  });

  it('keeps accents and non-Latin scripts', () => {
    expect(normalizeWord('Étoile')).toBe('étoile');
    expect(normalizeWord('「東京」')).toBe('東京');
  });

  it('punctuation alone normalises to nothing', () => {
    expect(normalizeWord('—')).toBe('');
    expect(normalizeWord('...')).toBe('');
  });
});
