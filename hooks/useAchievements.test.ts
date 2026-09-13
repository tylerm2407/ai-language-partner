/**
 * `fetchAchievements` used to be awaited with no catch: a rejection left
 * `loading` true forever (a permanent spinner in `AchievementGrid`, which
 * renders `loading ? '—' : count`) with no way to recover. These tests pin
 * that a failure clears loading, surfaces an error, and that `retry` re-runs
 * the load.
 */
import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAchievements } from './useAchievements';

let mockUser: { id: string } | null = { id: 'u1' };
const mockFetchAchievements = jest.fn();

jest.mock('./useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));

jest.mock('../stores/useAppStore', () => ({
  useAppStore: () => ({ profile: null, dailyStats: null }),
}));

jest.mock('../lib/achievements', () => ({
  fetchAchievements: (...a: unknown[]) => mockFetchAchievements(...a),
  checkAndAwardAchievements: jest.fn(async () => []),
}));

/** Mount the hook and expose its latest return value via a ref-like box. */
function mount() {
  const box: { current: ReturnType<typeof useAchievements> | null } = { current: null };
  function Probe() {
    box.current = useAchievements();
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(Probe));
  });
  return { box, rerender: () => act(() => renderer.update(createElement(Probe))) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1' };
});

it('clears loading and surfaces an error when the fetch rejects', async () => {
  mockFetchAchievements.mockRejectedValue(new Error('network down'));

  const { box } = mount();
  expect(box.current?.loading).toBe(true);

  await act(async () => {
    await Promise.resolve();
  });

  expect(box.current?.loading).toBe(false);
  expect(box.current?.error).toBe('network down');
  expect(box.current?.earnedAchievements).toEqual([]);
});

it('clears the error and reloads when retry is called', async () => {
  mockFetchAchievements.mockRejectedValueOnce(new Error('network down'));
  const { box, rerender } = mount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(box.current?.error).toBe('network down');

  mockFetchAchievements.mockResolvedValueOnce([
    { id: 'a1', userId: 'u1', type: 'first_lesson', earnedAt: '2026-09-13' },
  ]);
  await act(async () => {
    box.current?.retry();
    await Promise.resolve();
  });
  rerender();

  expect(box.current?.error).toBeNull();
  expect(box.current?.loading).toBe(false);
  expect(box.current?.earnedAchievements).toHaveLength(1);
});

it('never calls the fetch without a signed-in user, and is not left loading', () => {
  mockUser = null;
  const { box } = mount();
  expect(mockFetchAchievements).not.toHaveBeenCalled();
  expect(box.current?.loading).toBe(false);
});
