/**
 * Tests for fetchBooksRankedByCoverage (lib/supabase-queries.ts).
 *
 * The behaviour worth pinning is the re-ordering. The RPC returns book ids in
 * coverage order and the rows are then fetched with `.in()`, which gives no
 * ordering guarantee at all — so if the caller forgot to restore it, the shelf
 * would silently come back in whatever order Postgres felt like. That looks
 * exactly like a working feature and is the entire point of the feature not
 * working.
 */
const mockRpc = jest.fn();
const mockIn = jest.fn();

jest.mock('./supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: () => ({ select: () => ({ in: (...a: unknown[]) => mockIn(...a) }) }),
  },
}));

import { fetchBooksRankedByCoverage } from './supabase-queries';

function bookRow(id: string, title: string) {
  return {
    id,
    title,
    author: null,
    description: null,
    language: 'pt',
    cefr_level: 'B1',
    word_count: 1000,
    image_url: null,
    tags: [],
    source: 'gutenberg',
    source_id: '1',
    chapter_breaks: [],
    is_published: true,
    created_at: '2026-01-01T00:00:00Z',
  };
}

beforeEach(() => jest.clearAllMocks());

describe('fetchBooksRankedByCoverage', () => {
  it('returns books in the ranking order, not the order the rows arrive in', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { book_id: 'c', known_share: 0.34, common_share: 0.61 },
        { book_id: 'a', known_share: 0.30, common_share: 0.58 },
        { book_id: 'b', known_share: 0.12, common_share: 0.55 },
      ],
      error: null,
    });
    // Deliberately a different order — `.in()` makes no promise.
    mockIn.mockResolvedValue({
      data: [bookRow('a', 'A'), bookRow('b', 'B'), bookRow('c', 'C')],
      error: null,
    });

    const ranked = await fetchBooksRankedByCoverage('pt');

    expect(ranked.map((r) => r.book.id)).toEqual(['c', 'a', 'b']);
    expect(ranked[0].knownShare).toBeCloseTo(0.34);
    expect(ranked[0].commonShare).toBeCloseTo(0.61);
  });

  it('passes the language and limit through to the RPC', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await fetchBooksRankedByCoverage('fr', 12);
    expect(mockRpc).toHaveBeenCalledWith('rank_books_by_coverage', {
      p_language: 'fr',
      p_limit: 12,
    });
  });

  it('skips the row fetch entirely when nothing ranked', async () => {
    // Chinese, Japanese and Korean have no vocabulary profiles by design, so
    // this is a normal answer rather than an error — but it must not turn into
    // an `.in()` call with an empty list.
    mockRpc.mockResolvedValue({ data: [], error: null });
    expect(await fetchBooksRankedByCoverage('zh')).toEqual([]);
    expect(mockIn).not.toHaveBeenCalled();
  });

  it('drops a ranked id whose row did not come back, rather than emitting a hole', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { book_id: 'a', known_share: 0.2, common_share: 0.5 },
        { book_id: 'gone', known_share: 0.1, common_share: 0.4 },
      ],
      error: null,
    });
    mockIn.mockResolvedValue({ data: [bookRow('a', 'A')], error: null });

    const ranked = await fetchBooksRankedByCoverage('pt');
    expect(ranked).toHaveLength(1);
    expect(ranked[0].book.id).toBe('a');
  });

  it('throws on an RPC error instead of returning an empty shelf', async () => {
    // An empty shelf and a broken shelf look identical to a learner
    // (CLAUDE.md §5), so the screen needs to be able to tell them apart.
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchBooksRankedByCoverage('pt')).rejects.toBeTruthy();
  });

  it('throws when the row fetch fails', async () => {
    mockRpc.mockResolvedValue({
      data: [{ book_id: 'a', known_share: 0, common_share: 0.5 }],
      error: null,
    });
    mockIn.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchBooksRankedByCoverage('pt')).rejects.toBeTruthy();
  });
});
