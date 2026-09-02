/**
 * Tests for fetchGoalTrack (lib/supabase-queries.ts).
 *
 * The query pulls three tables in one round trip and flattens units -> lessons.
 * Two things are easy to get wrong and invisible if you do: lesson ORDER, and
 * the `generation_state` that decides whether a lesson can be opened at all.
 * A lesson shown as ready when it is still pending opens an empty lesson.
 */
const mockMaybeSingle = jest.fn();

jest.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ maybeSingle: (...a: unknown[]) => mockMaybeSingle(...a) }),
          }),
        }),
      }),
    }),
  },
}));

import { fetchGoalTrack } from './supabase-queries';

function row(lessons: { id: string; order_index: number; generation_state: string | null }[]) {
  return {
    goal_key: 'fr:hospitality:cafe_bar+restaurant:informal',
    scenarios: ['restaurant', 'cafe_bar'],
    course_id: 'c1',
    courses: {
      id: 'c1',
      title: 'Dinner in French',
      description: 'Order and chat your way through a meal.',
      units: [
        {
          id: 'u1',
          order_index: 0,
          lessons: lessons.map((l) => ({
            id: l.id,
            title: `Lesson ${l.id}`,
            description: 'do the thing',
            order_index: l.order_index,
            generation_state: l.generation_state,
          })),
        },
      ],
    },
  };
}

beforeEach(() => jest.clearAllMocks());

describe('fetchGoalTrack', () => {
  it('returns null when the learner has no track, rather than throwing', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await fetchGoalTrack('u')).toBeNull();
  });

  it('orders lessons by order_index, not by the order rows arrived in', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: row([
        { id: 'c', order_index: 2, generation_state: 'pending' },
        { id: 'a', order_index: 0, generation_state: 'ready' },
        { id: 'b', order_index: 1, generation_state: 'pending' },
      ]),
      error: null,
    });
    const track = await fetchGoalTrack('u');
    expect(track?.lessons.map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });

  it('carries generation_state through, since it gates opening the lesson', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: row([
        { id: 'a', order_index: 0, generation_state: 'ready' },
        { id: 'b', order_index: 1, generation_state: 'pending' },
        { id: 'c', order_index: 2, generation_state: 'generating' },
      ]),
      error: null,
    });
    const track = await fetchGoalTrack('u');
    expect(track?.lessons.map((l) => l.generationState)).toEqual([
      'ready',
      'pending',
      'generating',
    ]);
  });

  it('maps a hand-authored null state to null, not to pending', async () => {
    // Null means "always ready". Treating it as pending would send the client
    // off generating exercises for a lesson that already has them.
    mockMaybeSingle.mockResolvedValue({
      data: row([{ id: 'a', order_index: 0, generation_state: null }]),
      error: null,
    });
    const track = await fetchGoalTrack('u');
    expect(track?.lessons[0].generationState).toBeNull();
  });

  it('keeps the learner ranked scenarios, which the key deliberately sorts away', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: row([{ id: 'a', order_index: 0, generation_state: 'ready' }]),
      error: null,
    });
    const track = await fetchGoalTrack('u');
    // Key order is alphabetical; the learner's ranking is not, and it is what
    // decides lesson order when the track is extended.
    expect(track?.scenarios).toEqual(['restaurant', 'cafe_bar']);
    expect(track?.goalKey).toContain('cafe_bar+restaurant');
  });

  it('throws on error instead of reporting no track', async () => {
    // "You have no goal track" and "the query failed" look identical to a
    // learner, and only one of them should offer to build one (CLAUDE.md §5).
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchGoalTrack('u')).rejects.toBeTruthy();
  });

  it('survives a track whose unit has no lessons yet', async () => {
    mockMaybeSingle.mockResolvedValue({ data: row([]), error: null });
    const track = await fetchGoalTrack('u');
    expect(track?.lessons).toEqual([]);
    expect(track?.title).toBe('Dinner in French');
  });
});
