/**
 * Tests for fetchGoalTrack (lib/supabase-queries.ts).
 *
 * The query pulls three tables in one round trip and flattens units -> lessons,
 * then a second round trip attaches the learner's completions. Three things
 * are easy to get wrong and invisible if you do: lesson ORDER, the
 * `generation_state` that decides whether a lesson can be opened at all, and
 * which lesson a completion lands on. A lesson shown as ready when it is
 * still pending opens an empty lesson; a completion on the wrong lesson tells
 * the learner they finished something they never opened.
 */
import { fetchGoalTrack } from './supabase-queries';

const mockMaybeSingle = jest.fn();
const mockCompletions = jest.fn();
const mockCompletionsIn = jest.fn();
const mockCompletionsLimit = jest.fn();

jest.mock('./supabase', () => ({
  supabase: {
    from: (table: string) =>
      table === 'lesson_completions'
        ? {
            select: () => ({
              eq: () => ({
                in: (_column: string, ids: string[]) => {
                  mockCompletionsIn(ids);
                  return {
                    limit: (n: number) => {
                      mockCompletionsLimit(n);
                      return mockCompletions();
                    },
                  };
                },
              }),
            }),
          }
        : {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({ maybeSingle: (...a: unknown[]) => mockMaybeSingle(...a) }),
                }),
              }),
            }),
          },
  },
}));

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

beforeEach(() => {
  jest.clearAllMocks();
  mockCompletions.mockResolvedValue({ data: [], error: null });
});

describe('fetchGoalTrack', () => {
  it('returns null when the learner has no track, rather than throwing', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await fetchGoalTrack('u')).toBeNull();
    expect(mockCompletions).not.toHaveBeenCalled();
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
    // Nothing to look up, so nothing is asked.
    expect(mockCompletions).not.toHaveBeenCalled();
  });

  // ── completions ──────────────────────────────────────────────────────────

  const threeLessons = row([
    { id: 'a', order_index: 0, generation_state: 'ready' },
    { id: 'b', order_index: 1, generation_state: 'ready' },
    { id: 'c', order_index: 2, generation_state: 'pending' },
  ]);

  it('attaches each completion to its own lesson and leaves the rest null', async () => {
    mockMaybeSingle.mockResolvedValue({ data: threeLessons, error: null });
    mockCompletions.mockResolvedValue({
      data: [
        { lesson_id: 'b', score: 0.8, completed_at: '2026-09-13T10:00:00Z' },
        { lesson_id: 'a', score: 1, completed_at: '2026-09-12T10:00:00Z' },
      ],
      error: null,
    });
    const track = await fetchGoalTrack('u');
    expect(track?.lessons.map((l) => l.completion)).toEqual([
      { score: 1, completedAt: '2026-09-12T10:00:00Z' },
      { score: 0.8, completedAt: '2026-09-13T10:00:00Z' },
      null,
    ]);
  });

  it('asks only for the track lessons, capped at exactly that many rows', async () => {
    // Completions are unique per (user, lesson), so the id list bounds the
    // answer and the limit is a runaway guard rather than a page size.
    mockMaybeSingle.mockResolvedValue({ data: threeLessons, error: null });
    await fetchGoalTrack('u');
    expect(mockCompletionsIn).toHaveBeenCalledWith(['a', 'b', 'c']);
    expect(mockCompletionsLimit).toHaveBeenCalledWith(3);
  });

  it('keeps a completion whose score is missing, with a null score', async () => {
    mockMaybeSingle.mockResolvedValue({ data: threeLessons, error: null });
    mockCompletions.mockResolvedValue({
      data: [{ lesson_id: 'a', score: null, completed_at: '2026-09-12T10:00:00Z' }],
      error: null,
    });
    const track = await fetchGoalTrack('u');
    expect(track?.lessons[0].completion).toEqual({ score: null, completedAt: '2026-09-12T10:00:00Z' });
  });

  it('throws when the completions read fails, rather than showing nothing done', async () => {
    // Zero completions on a failed read would quietly reset a learner's
    // progress bar to empty.
    mockMaybeSingle.mockResolvedValue({ data: threeLessons, error: null });
    mockCompletions.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchGoalTrack('u')).rejects.toBeTruthy();
  });
});
