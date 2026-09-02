import {
  COMMON_BAND,
  COVERAGE_LANGUAGES,
  countTypes,
  MIN_TOKENS,
  TOP_TERMS_PER_BOOK,
  topN,
  topNCoverage,
} from './build-book-vocab';

describe('countTypes', () => {
  it('counts running words, not distinct ones', () => {
    // Coverage is a share of running words: "le" being three of eight tokens
    // is what makes a book readable, not that it is one of six types.
    const { counts, total } = countTypes('le roi et le fils et le chien');
    expect(total).toBe(8);
    expect(counts.get('le')).toBe(3);
    expect(counts.size).toBe(5);
  });

  it('uses the reader tokenizer, so punctuation and case fold together', () => {
    const { counts, total } = countTypes('«Roi», roi. ROI');
    expect(total).toBe(3);
    expect(counts.get('roi')).toBe(3);
  });

  it('survives CRLF-wrapped Gutenberg text', () => {
    expect(countTypes('un roi\r\nqui régnait').total).toBe(4);
  });

  it('empty content counts nothing', () => {
    expect(countTypes('').total).toBe(0);
  });
});

describe('topN', () => {
  const counts = new Map([['le', 10], ['roi', 5], ['chien', 5], ['zèbre', 1]]);

  it('returns the densest forms first, with counts aligned by position', () => {
    // The two arrays are read positionally by the ranking; a misalignment
    // would attribute one word's count to another and never error.
    const { terms, counts: got } = topN(counts, 3);
    expect(terms).toHaveLength(got.length);
    expect(terms[0]).toBe('le');
    expect(got[0]).toBe(10);
  });

  it('breaks count ties on the term, so a rebuild is deterministic', () => {
    expect(topN(counts, 3).terms).toEqual(['le', 'chien', 'roi']);
  });

  it('returns everything when there are fewer forms than requested', () => {
    expect(topN(counts, 500).terms).toHaveLength(4);
  });
});

describe('topNCoverage', () => {
  it('is the share of running words the densest forms account for', () => {
    const { counts, total } = countTypes('le le le roi');
    expect(topNCoverage(counts, total, 1)).toBeCloseTo(0.75);
    expect(topNCoverage(counts, total, 2)).toBeCloseTo(1);
  });

  it('asking for more forms than exist does not exceed 1', () => {
    const { counts, total } = countTypes('le roi');
    expect(topNCoverage(counts, total, 999)).toBeLessThanOrEqual(1);
  });

  it('an empty book is 0, not NaN', () => {
    expect(topNCoverage(new Map(), 0, 100)).toBe(0);
  });
});

describe('build constants', () => {
  it('excludes the languages whitespace tokenization cannot handle', () => {
    // zh/ja/ko do not delimit words with spaces, so wordTokens would make every
    // "token" a whole clause. Their shelves keep the existing ordering.
    for (const cjk of ['zh', 'ja', 'ko']) {
      expect(COVERAGE_LANGUAGES).not.toContain(cjk);
    }
    expect(COVERAGE_LANGUAGES).toContain('fr');
  });

  it('stores fewer terms per book than the common band it is scored against', () => {
    // common_share is measured over the whole book against the top COMMON_BAND
    // corpus forms; TOP_TERMS_PER_BOOK only bounds what the per-learner
    // intersection can see.
    expect(TOP_TERMS_PER_BOOK).toBeLessThan(COMMON_BAND);
  });

  it('keeps a floor high enough to exclude licence stubs and track listings', () => {
    expect(MIN_TOKENS).toBeGreaterThanOrEqual(500);
  });
});
