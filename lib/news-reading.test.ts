/**
 * Tests for the daily-news evidence wrappers (lib/supabase-queries.ts).
 *
 * Pinned: the answers reach `record_news_reading` as ONE call with the two
 * `p_` parameters; the returned row maps to `NewsReadingResult`; the article
 * mapper keeps a well-formed quiz, drops the correct index, and turns a
 * malformed one into null rather than a question nobody can answer.
 */
import { fetchDailyNews, fetchNewsReadingResult, recordNewsReading } from './supabase-queries';

const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock('./supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: (...a: unknown[]) => mockFrom(...a),
  },
}));

const RESULT_ROW = {
  id: 'r1',
  user_id: 'u1',
  article_id: 'a1',
  target_language: 'es',
  cefr_level: 'B1',
  comprehension: 0.6667,
  questions_total: 3,
  completed_at: '2026-09-13T10:00:00Z',
};

function articleRow(questions: unknown) {
  return {
    id: 'a1',
    date: '2026-09-13',
    language: 'es',
    tier: 'easy',
    cefr_level: 'B1',
    title: 'T',
    title_translation: null,
    summary: 'S',
    content: 'C',
    content_translation: null,
    vocabulary_highlights: [],
    source_topic: null,
    image_url: null,
    created_at: '2026-09-13T09:00:00Z',
    audio_status: 'ready',
    audio_duration_ms: 1000,
    questions,
  };
}

/** A chainable `.from()` stub whose terminal `maybeSingle` resolves to `row`. */
function fromResolving(row: unknown) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'lte', 'order', 'limit']) chain[m] = () => chain;
  chain.maybeSingle = async () => ({ data: row, error: null });
  return chain;
}

beforeEach(() => {
  mockRpc.mockReset();
  mockFrom.mockReset();
});

describe('recordNewsReading', () => {
  it('sends the answers as one RPC call and maps the returned row', async () => {
    mockRpc.mockResolvedValue({ data: RESULT_ROW, error: null });

    const result = await recordNewsReading('a1', [1, 0, 3]);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('record_news_reading', {
      p_article_id: 'a1',
      p_answers: [1, 0, 3],
    });
    expect(result).toEqual({
      id: 'r1',
      userId: 'u1',
      articleId: 'a1',
      targetLanguage: 'es',
      cefrLevel: 'B1',
      comprehension: 0.6667,
      questionsTotal: 3,
      completedAt: '2026-09-13T10:00:00Z',
    });
  });

  it('throws the RPC error rather than returning a fake result', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('article has no comprehension questions') });
    await expect(recordNewsReading('a1', [0, 0, 0])).rejects.toThrow('no comprehension questions');
  });

  it('throws when the RPC returns no row', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(recordNewsReading('a1', [0, 0, 0])).rejects.toThrow('returned no row');
  });
});

describe('fetchNewsReadingResult', () => {
  it('maps a stored row and returns null when there is none', async () => {
    mockFrom.mockReturnValue(fromResolving(RESULT_ROW));
    expect((await fetchNewsReadingResult('u1', 'a1'))?.questionsTotal).toBe(3);
    expect(mockFrom).toHaveBeenCalledWith('news_reading_results');

    mockFrom.mockReturnValue(fromResolving(null));
    expect(await fetchNewsReadingResult('u1', 'a1')).toBeNull();
  });
});

describe('article questions mapping', () => {
  const GOOD = [
    { question: 'Q1', options: ['a', 'b', 'c', 'd'], answer: 2 },
    { question: 'Q2', options: ['a', 'b', 'c', 'd'], answer: 0 },
    { question: 'Q3', options: ['a', 'b', 'c', 'd'], answer: 1 },
  ];

  it('keeps question and options and drops the correct index', async () => {
    mockFrom.mockReturnValue(fromResolving(articleRow(GOOD)));
    const article = await fetchDailyNews('es', 'easy', '2026-09-13');
    expect(article?.questions).toEqual([
      { question: 'Q1', options: ['a', 'b', 'c', 'd'] },
      { question: 'Q2', options: ['a', 'b', 'c', 'd'] },
      { question: 'Q3', options: ['a', 'b', 'c', 'd'] },
    ]);
    expect(JSON.stringify(article?.questions)).not.toContain('answer');
  });

  it('a null column (generation failed) maps to null', async () => {
    mockFrom.mockReturnValue(fromResolving(articleRow(null)));
    expect((await fetchDailyNews('es', 'easy', '2026-09-13'))?.questions).toBeNull();
  });

  it('a malformed quiz maps to null rather than a question nobody can answer', async () => {
    const threeOptions = [GOOD[0], { question: 'Q2', options: ['a', 'b', 'c'], answer: 0 }, GOOD[2]];
    mockFrom.mockReturnValue(fromResolving(articleRow(threeOptions)));
    expect((await fetchDailyNews('es', 'easy', '2026-09-13'))?.questions).toBeNull();

    mockFrom.mockReturnValue(fromResolving(articleRow([])));
    expect((await fetchDailyNews('es', 'easy', '2026-09-13'))?.questions).toBeNull();

    mockFrom.mockReturnValue(fromResolving(articleRow('not an array')));
    expect((await fetchDailyNews('es', 'easy', '2026-09-13'))?.questions).toBeNull();
  });
});
