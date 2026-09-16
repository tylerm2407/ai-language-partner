/**
 * useMissionProgress — the picker's one read, and what each failure may do.
 *
 * The rules pinned here are the ones a refactor would most plausibly lose:
 * nothing is fetched without a user; a goal-track failure never blanks the
 * picker; a progress failure surfaces an error but keeps what did load; the
 * newest open attempt wins; and Free Chat's resume flag ignores mission rows
 * on the same table. `buildPickerMissions` is asserted state by state so the
 * picker's sheet copy can be trusted from the shape alone.
 */

import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as queries from '../lib/supabase-queries';
import type { ChatSession, MissionProgressRow, OpenMissionAttempt } from '../lib/supabase-queries';
import {
  buildPickerMissions,
  hasFreeChatSession,
  newestOpenAttemptByScene,
  progressByScene,
  useMissionProgress,
  type MissionProgressState,
} from './useMissionProgress';

jest.mock('../lib/supabase-queries', () => ({
  fetchMissionProgress: jest.fn(async () => []),
  fetchOpenMissionAttempts: jest.fn(async () => []),
  listChatSessions: jest.fn(async () => []),
  fetchGoalTrack: jest.fn(async () => null),
}));

const row = (over: Partial<MissionProgressRow>): MissionProgressRow => ({
  scenarioKey: 'restaurant',
  stage: 1,
  attempts: 1,
  bestAccuracy: null,
  passedAt: null,
  ...over,
});

const attempt = (over: Partial<OpenMissionAttempt>): OpenMissionAttempt => ({
  chatSessionId: 'cs1',
  scenarioKey: 'restaurant',
  stage: 1,
  objectivesMet: [],
  startedAt: '2026-09-13T10:00:00Z',
  ...over,
});

const session = (over: Partial<ChatSession>): ChatSession => ({
  id: 's1',
  userId: 'u1',
  scenarioKey: 'free_chat',
  targetLanguage: 'es',
  level: 'beginner',
  missionStage: null,
  createdAt: '2026-09-13T10:00:00Z',
  updatedAt: '2026-09-13T10:00:00Z',
  ...over,
});

/** Mount the hook on a component that renders nothing and hand back its latest value. */
async function mount(userId: string | undefined, language = 'es') {
  const latest: { current: MissionProgressState | null } = { current: null };
  function Probe() {
    latest.current = useMissionProgress(userId, language);
    return null;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(createElement(Probe));
  });
  return { latest, renderer };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(queries.fetchMissionProgress).mockResolvedValue([]);
  jest.mocked(queries.fetchOpenMissionAttempts).mockResolvedValue([]);
  jest.mocked(queries.listChatSessions).mockResolvedValue([]);
  jest.mocked(queries.fetchGoalTrack).mockResolvedValue(null);
});

describe('useMissionProgress', () => {
  it('fetches nothing without a user, and is not "loading" forever', async () => {
    const { latest } = await mount(undefined);
    expect(queries.fetchMissionProgress).not.toHaveBeenCalled();
    expect(queries.fetchGoalTrack).not.toHaveBeenCalled();
    expect(latest.current?.loading).toBe(false);
    expect(latest.current?.progress.size).toBe(0);
  });

  it('reads all four sources for the user and language and shapes them', async () => {
    jest.mocked(queries.fetchMissionProgress).mockResolvedValue([
      row({ stage: 1, passedAt: '2026-09-01', bestAccuracy: 0.6 }),
      row({ stage: 2, passedAt: '2026-09-02', bestAccuracy: 0.82 }),
      row({ stage: 3, bestAccuracy: 0.4 }),
      row({ scenarioKey: 'doctor', stage: 1 }),
    ]);
    jest.mocked(queries.fetchOpenMissionAttempts).mockResolvedValue([
      attempt({ stage: 3, chatSessionId: 'open-1', objectivesMet: ['describe_problem'] }),
    ]);
    jest.mocked(queries.listChatSessions).mockResolvedValue([session({})]);
    jest.mocked(queries.fetchGoalTrack).mockResolvedValue({
      courseId: 'c', goalKey: 'travel', title: '', description: '', scenarios: ['directions', 'airport_hotel'], lessons: [],
    });

    const { latest } = await mount('u1');

    expect(queries.fetchMissionProgress).toHaveBeenCalledWith('u1', 'es');
    expect(queries.fetchOpenMissionAttempts).toHaveBeenCalledWith('u1', 'es');
    // Language-scoped: a bounded scan of another language's sessions could
    // otherwise hide the resumable one.
    expect(queries.listChatSessions).toHaveBeenCalledWith('u1', 50, 'es');
    expect(queries.fetchGoalTrack).toHaveBeenCalledWith('u1', 'es');

    const s = latest.current!;
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
    expect(s.progress.get('restaurant')).toEqual({ highestUnlocked: 3, bestAccuracy: 0.82 });
    expect(s.progress.get('doctor')).toEqual({ highestUnlocked: 1, bestAccuracy: null });
    expect(s.openAttempts.get('restaurant')).toEqual({ stage: 3, sessionId: 'open-1', objectivesMet: ['describe_problem'] });
    expect(s.freeChatResumable).toBe(true);
    expect(s.goalScenes).toEqual(['directions', 'airport_hotel']);
  });

  it('a goal-track failure is silent: order falls back, nothing else is touched', async () => {
    jest.mocked(queries.fetchMissionProgress).mockResolvedValue([row({ stage: 1, passedAt: '2026-09-01' })]);
    jest.mocked(queries.fetchGoalTrack).mockRejectedValue(new Error('boom'));

    const { latest } = await mount('u1');

    expect(latest.current?.goalScenes).toEqual([]);
    expect(latest.current?.error).toBeNull();
    expect(latest.current?.progress.get('restaurant')?.highestUnlocked).toBe(2);
  });

  it('a progress failure sets a user-facing sentence and keeps what did load', async () => {
    jest.mocked(queries.fetchMissionProgress).mockRejectedValue({ message: 'permission denied for table', code: '42501' });
    jest.mocked(queries.fetchOpenMissionAttempts).mockResolvedValue([attempt({ stage: 2 })]);

    const { latest } = await mount('u1');

    expect(latest.current?.error).toEqual(expect.any(String));
    // Never the raw Postgres text.
    expect(latest.current?.error).not.toContain('permission denied');
    expect(latest.current?.openAttempts.get('restaurant')?.stage).toBe(2);
    expect(latest.current?.loading).toBe(false);
  });

  it('refresh reads again and clears a previous error', async () => {
    jest.mocked(queries.fetchOpenMissionAttempts).mockRejectedValueOnce(new Error('network request failed'));
    const { latest } = await mount('u1');
    expect(latest.current?.error).toEqual(expect.any(String));

    await act(async () => {
      await latest.current!.refresh();
    });

    expect(queries.fetchOpenMissionAttempts).toHaveBeenCalledTimes(2);
    expect(latest.current?.error).toBeNull();
  });
});

describe('the pure shapers', () => {
  it('progressByScene: highestUnlocked is max passed + 1, best accuracy is the scene max', () => {
    const m = progressByScene([
      row({ stage: 1, passedAt: 'x', bestAccuracy: 0.9 }),
      row({ stage: 2, passedAt: null, bestAccuracy: 0.5 }),
    ]);
    expect(m.get('restaurant')).toEqual({ highestUnlocked: 2, bestAccuracy: 0.9 });
  });

  it('newestOpenAttemptByScene: the newest wins regardless of row order', () => {
    const m = newestOpenAttemptByScene([
      attempt({ chatSessionId: 'old', stage: 2, startedAt: '2026-09-01T00:00:00Z' }),
      attempt({ chatSessionId: 'new', stage: 2, startedAt: '2026-09-12T00:00:00Z', objectivesMet: ['ask_dish'] }),
    ]);
    expect(m.get('restaurant')).toEqual({ stage: 2, sessionId: 'new', objectivesMet: ['ask_dish'] });
  });

  it('hasFreeChatSession ignores mission rows and other languages', () => {
    expect(hasFreeChatSession([session({ missionStage: 2 })], 'es')).toBe(false);
    expect(hasFreeChatSession([session({ targetLanguage: 'fr' })], 'es')).toBe(false);
    expect(hasFreeChatSession([session({ scenarioKey: 'restaurant' })], 'es')).toBe(false);
    expect(hasFreeChatSession([session({})], 'es')).toBe(true);
  });
});

describe('buildPickerMissions', () => {
  const none = { progress: new Map(), openAttempts: new Map() };

  it('no progress at all: every scene is at mission 1, start', () => {
    const m = buildPickerMissions({ ...none, paid: true });
    expect(m.has('free_chat')).toBe(false);
    const r = m.get('restaurant')!;
    expect(r.dots).toEqual(['current', 'locked', 'locked', 'locked']);
    expect(r.cta).toBe('start');
    expect(r.stage).toBe(1);
    expect(r.mission?.title).toBe('A table and a drink');
    expect(r.objectivesMet).toEqual([]);
    expect(r.bestAccuracy).toBeNull();
  });

  it('loading withholds the dots but the sheet still has a mission and a stage', () => {
    const r = buildPickerMissions({ ...none, paid: true, loading: true }).get('restaurant')!;
    expect(r.dots).toBeNull();
    expect(r.stage).toBe(1);
    expect(r.mission?.stage).toBe(1);
  });

  it('partial progress: passed stages fill, the next is current', () => {
    const r = buildPickerMissions({
      progress: new Map([['restaurant', { highestUnlocked: 3, bestAccuracy: 0.82 }]]),
      openAttempts: new Map(),
      paid: true,
    }).get('restaurant')!;
    expect(r.dots).toEqual(['done', 'done', 'current', 'locked']);
    expect(r.stage).toBe(3);
    expect(r.mission?.title).toBe('Something is wrong with the order');
    expect(r.bestAccuracy).toBe(0.82);
  });

  it('ladder done: four filled dots, replay, mission 4 shown, stage null', () => {
    const r = buildPickerMissions({
      progress: new Map([['restaurant', { highestUnlocked: 5, bestAccuracy: 0.9 }]]),
      openAttempts: new Map(),
      paid: true,
    }).get('restaurant')!;
    expect(r.dots).toEqual(['done', 'done', 'done', 'done']);
    expect(r.cta).toBe('replay');
    expect(r.stage).toBeNull();
    expect(r.mission?.stage).toBe(4);
  });

  it('an open attempt: resume on its stage with its objectives', () => {
    const r = buildPickerMissions({
      progress: new Map([['restaurant', { highestUnlocked: 2, bestAccuracy: null }]]),
      openAttempts: new Map([['restaurant', { stage: 2, sessionId: 'cs', objectivesMet: ['ask_dish'] }]]),
      paid: true,
    }).get('restaurant')!;
    expect(r.cta).toBe('resume');
    expect(r.stage).toBe(2);
    expect(r.objectivesMet).toEqual(['ask_dish']);
  });

  it('unpaid: dots still show progress, the button goes to plans', () => {
    const r = buildPickerMissions({
      progress: new Map([['restaurant', { highestUnlocked: 2, bestAccuracy: null }]]),
      openAttempts: new Map(),
      paid: false,
    }).get('restaurant')!;
    expect(r.dots).toEqual(['done', 'current', 'locked', 'locked']);
    expect(r.cta).toBe('plans');
  });
});
