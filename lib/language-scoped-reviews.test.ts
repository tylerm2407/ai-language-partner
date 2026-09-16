/**
 * Tests for the language scoping of the SRS reads (lib/supabase-queries.ts,
 * migration 133).
 *
 * The bug these exist to keep fixed: `review_items` is keyed on (user, card)
 * and knows nothing about language, so a learner who switched to Russian was
 * still dealt their Spanish deck — and the multiple-choice distractors came
 * from it too. The language lives on `cards.language`, so what has to hold is
 * that every one of these reads joins `cards!inner` and filters on it, and
 * that passing no language still reads the whole account (offline replay and
 * maintenance paths have no profile in hand).
 *
 * `languageVariants` is what goes into the filter rather than the bare code:
 * the column is free text and has carried both 'es' and 'spanish'.
 */
import {
  fetchDueReviewItems,
  fetchReviewItemCount,
  fetchReviewDeckCards,
  switchTargetLanguage,
} from './supabase-queries';

interface Recorded {
  table: string;
  select: string;
  filters: { op: string; column: string; value: unknown }[];
}

const mockRecorded: Recorded[] = [];
const mockRpc = jest.fn();

/** Minimal chainable PostgREST stub: every call records itself and returns
 *  the same object, so a query's shape can be asserted after the fact. */
function mockBuilder(entry: Recorded, result: { data?: unknown; count?: number; error: null }) {
  const chain: Record<string, unknown> = {};
  const record = (op: string) => (column: string, value: unknown) => {
    entry.filters.push({ op, column, value });
    return chain;
  };
  Object.assign(chain, {
    eq: record('eq'),
    in: record('in'),
    lte: record('lte'),
    lt: record('lt'),
    not: (column: string, op: string, value: unknown) => {
      entry.filters.push({ op: `not.${op}`, column, value });
      return chain;
    },
    order: () => chain,
    limit: () => Promise.resolve(result),
    then: (resolve: (r: unknown) => unknown) => Promise.resolve(result).then(resolve),
  });
  return chain;
}

let mockNextResult: { data?: unknown; count?: number; error: null } = { data: [], error: null };

jest.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: (select: string) => {
        const entry: Recorded = { table, select, filters: [] };
        mockRecorded.push(entry);
        return mockBuilder(entry, mockNextResult);
      },
    }),
    rpc: (...a: unknown[]) => mockRpc(...a),
  },
}));

beforeEach(() => {
  mockRecorded.length = 0;
  mockRpc.mockReset();
  mockNextResult = { data: [], count: 0, error: null };
});

const languageFilter = (entry: Recorded) =>
  entry.filters.find((f) => f.column === 'cards.language');

it('deals only the active language’s due cards', async () => {
  await fetchDueReviewItems('u1', 50, 'ru');

  const [query] = mockRecorded;
  expect(query.select).toContain('cards!inner');
  expect(languageFilter(query)).toEqual({
    op: 'in',
    column: 'cards.language',
    // Every spelling the free-text column has carried, from `languageVariants`.
    value: ['ru', 'Russian', 'russian'],
  });
});

it('counts only the active language', async () => {
  await fetchReviewItemCount('u1', 'es');

  expect(languageFilter(mockRecorded[0])).toMatchObject({ op: 'in', column: 'cards.language' });
  expect(languageFilter(mockRecorded[0])?.value).toContain('es');
});

it('draws distractors only from the active language', async () => {
  await fetchReviewDeckCards('u1', 200, 'ja');

  expect(languageFilter(mockRecorded[0])?.value).toContain('ja');
});

it('reads every language when none is named', async () => {
  await fetchDueReviewItems('u1');
  await fetchReviewItemCount('u1');
  await fetchReviewDeckCards('u1');

  for (const entry of mockRecorded) {
    expect(languageFilter(entry)).toBeUndefined();
  }
});

it('switches through the RPC, placement included only when starting a language', async () => {
  mockRpc.mockResolvedValue({
    data: {
      id: 'p1',
      user_id: 'u1',
      display_name: 'Tyler',
      native_language: 'en',
      target_language: 'ru',
      level: 'beginner',
      current_course_id: null,
      placement_band: 'A1',
      daily_goal_minutes: 10,
      timezone: 'America/New_York',
      onboarding_completed: true,
      avatar_kind: 'preset',
      avatar_preset_id: null,
      avatar_image_path: null,
      onboarding_checklist: null,
      motivation_reason: null,
      ideal_l2_self: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    error: null,
  });

  const profile = await switchTargetLanguage('ru');
  expect(mockRpc).toHaveBeenCalledWith('switch_target_language', {
    p_language: 'ru',
    p_level: null,
    p_current_course_id: null,
    p_placement_band: null,
  });
  expect(profile.targetLanguage).toBe('ru');

  await switchTargetLanguage('ru', { level: 'beginner', currentCourseId: 'c1', placementBand: 'A1' });
  expect(mockRpc).toHaveBeenLastCalledWith('switch_target_language', {
    p_language: 'ru',
    p_level: 'beginner',
    p_current_course_id: 'c1',
    p_placement_band: 'A1',
  });
});
