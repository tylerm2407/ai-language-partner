/**
 * The badge that would not go away.
 *
 * A learner cleared every due card in a lesson warm-up, went back to the learn
 * page, and it still advertised "2 cards due" — the database said zero. The
 * count is store state, and the only path that refreshed it was
 * `useReviewQueue.submitReview`; the warm-up's own `upsertReviewItem` and the
 * offline queue's replay both changed the truth without telling the store.
 *
 * This hook is the general answer — re-read on focus, so it covers write paths
 * this app never sees, including another device. These tests pin the two things
 * that make it work: it fires on focus, and it does not fire without a user
 * (which would query with `undefined` and count nobody's cards).
 */

import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as queries from '../lib/supabase-queries';
import { useAppStore } from '../stores/useAppStore';
import { useReviewCountSync } from './useReviewCountSync';

let mockFocusCallback: (() => void) | null = null;
let mockUser: { id: string } | null = { id: 'u1' };

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    mockFocusCallback = cb;
  },
}));

jest.mock('./useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));

jest.mock('../lib/supabase-queries', () => ({
  fetchProfile: jest.fn(),
  fetchTodayStats: jest.fn(),
  fetchSubscription: jest.fn(),
  fetchReviewItemCount: jest.fn(async () => 0),
  fetchUserRoles: jest.fn(),
  fetchHasCompletedLesson: jest.fn(),
  fetchHasAiConversation: jest.fn(),
}));

/** Mount the hook on a component that renders nothing. */
function mount() {
  function Probe() {
    useReviewCountSync();
    return null;
  }
  act(() => {
    TestRenderer.create(createElement(Probe));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFocusCallback = null;
  mockUser = { id: 'u1' };
  useAppStore.getState().reset();
});

it('re-reads the due count when the screen regains focus', async () => {
  useAppStore.setState({ reviewCount: 2 });
  jest.mocked(queries.fetchReviewItemCount).mockResolvedValue(0);

  mount();
  expect(mockFocusCallback).not.toBeNull();
  await act(async () => { mockFocusCallback!(); });

  // No profile loaded in this harness, so the language is null — "every
  // language", which is what an account with nothing loaded should be counted
  // as rather than silently filtering to nothing.
  expect(queries.fetchReviewItemCount).toHaveBeenCalledWith('u1', null);
  expect(useAppStore.getState().reviewCount).toBe(0);
});

it('counts only the active language', async () => {
  useAppStore.setState({
    profile: { targetLanguage: 'ru' } as unknown as NonNullable<ReturnType<typeof useAppStore.getState>['profile']>,
  });
  jest.mocked(queries.fetchReviewItemCount).mockResolvedValue(3);

  mount();
  await act(async () => { mockFocusCallback!(); });

  expect(queries.fetchReviewItemCount).toHaveBeenCalledWith('u1', 'ru');
  expect(useAppStore.getState().reviewCount).toBe(3);
});

it('does not query before there is a signed-in user', async () => {
  mockUser = null;

  mount();
  await act(async () => { mockFocusCallback!(); });

  expect(queries.fetchReviewItemCount).not.toHaveBeenCalled();
});
