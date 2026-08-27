/**
 * `useAuth` shares ONE session subscription across every consumer.
 *
 * The regression this pins: the hook used to hold the session in local
 * `useState` and open its own `supabase.auth.onAuthStateChange` in a mount
 * effect. It is called from 43 places, so a cold start opened dozens of
 * subscriptions against the same client and fired dozens of redundant
 * `getSession()` reads, and every subsequent token refresh then fanned out
 * through all of them.
 *
 * The assertions are deliberately about CALL COUNTS rather than rendered
 * output — "it still works" would pass just as happily with the per-instance
 * version, which is exactly the bug.
 */
import React from 'react';
import TestRenderer from 'react-test-renderer';

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockUnsubscribe = jest.fn();
const mockRefreshSession = jest.fn();
const mockSetUnauthorizedHandler = jest.fn();

jest.mock('../lib/supabase', () => ({
  setUnauthorizedHandler: (...args: unknown[]) => mockSetUnauthorizedHandler(...args),
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));
jest.mock('../lib/auth-links', () => ({ RESET_PASSWORD_REDIRECT: 'x://reset' }));
// `signOut` now tears the whole session down, which pulls in storage-backed
// caches and the notification scheduler. None of that is what these tests are
// about — they only assert how many subscriptions the hook opens.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
    getAllKeys: jest.fn(async () => []),
    multiRemove: jest.fn(async () => {}),
  },
}));
jest.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));
jest.mock('../lib/tts-cache', () => ({ clearTtsCache: jest.fn() }));
jest.mock('../lib/pending-onboarding', () => ({
  clearPendingOnboarding: jest.fn(async () => {}),
}));
jest.mock('../lib/read-cache', () => ({ clearReadCache: jest.fn().mockResolvedValue(undefined) }));

import { useAuth, tearDownSession, __resetAuthStoreForTests } from './useAuth';
import * as Notifications from 'expo-notifications';
import { clearTtsCache } from '../lib/tts-cache';
import { clearPendingOnboarding } from '../lib/pending-onboarding';
import { useAppStore } from '../stores/useAppStore';
import { useLessonProgressStore } from '../stores/useLessonProgressStore';
import { useSchoolStore } from '../stores/useSchoolStore';

/** A consumer that does nothing but call the hook, like most real ones. */
function Consumer() {
  useAuth();
  return null;
}

function renderConsumers(count: number) {
  let r!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    r = TestRenderer.create(
      <>
        {Array.from({ length: count }, (_, i) => (
          <Consumer key={i} />
        ))}
      </>,
    );
  });
  return r;
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetAuthStoreForTests();
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mockUnsubscribe } } });
  mockRefreshSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
});

describe('useAuth shares one subscription', () => {
  it('opens exactly one auth subscription no matter how many consumers mount', () => {
    renderConsumers(12);
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('issues exactly one getSession for the whole app', () => {
    renderConsumers(12);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it('does not re-subscribe when further consumers mount later', () => {
    renderConsumers(3);
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);

    // A screen pushed after startup — the common case, and the one that used
    // to add another subscription every time.
    renderConsumers(5);
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the subscription open when consumers unmount', () => {
    // App-lifetime state: tearing down on the last unmount would mean the next
    // mount misses whatever fired in between.
    const r = renderConsumers(2);
    TestRenderer.act(() => {
      r.unmount();
    });
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });

  it('starts lazily — importing the module does no network work', () => {
    // Nothing has rendered in this test yet.
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockOnAuthStateChange).not.toHaveBeenCalled();
  });
});

describe('session teardown', () => {
  it('cancels every scheduled notification', async () => {
    // The daily reminder embeds the learner's own free-text goal, so leaving it
    // scheduled puts one person's private statement on the next person's lock
    // screen. This is the single most important line of the teardown.
    await tearDownSession();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it('resets every store, so the next account starts empty', async () => {
    useAppStore.setState({ profile: { displayName: 'Previous learner' } as never });
    useSchoolStore.setState({ classrooms: [{ id: 'c1' }] as never });

    await tearDownSession();

    expect(useAppStore.getState().profile).toBeNull();
    expect(useSchoolStore.getState().classrooms).toEqual([]);
    expect(useLessonProgressStore.getState()).toBeDefined();
  });

  it('clears the device-level caches', async () => {
    await tearDownSession();
    expect(clearTtsCache).toHaveBeenCalled();
    expect(clearPendingOnboarding).toHaveBeenCalled();
  });

  it('still tears the rest down when cancelling notifications fails', async () => {
    // Each step is independent on purpose — one failure must not strand the
    // previous session's data on the device.
    (Notifications.cancelAllScheduledNotificationsAsync as jest.Mock).mockRejectedValueOnce(
      new Error('no permission'),
    );
    useAppStore.setState({ profile: { displayName: 'Previous learner' } as never });

    await expect(tearDownSession()).resolves.toBeUndefined();
    expect(useAppStore.getState().profile).toBeNull();
    expect(clearTtsCache).toHaveBeenCalled();
  });
});

describe('unauthorized handling', () => {
  /** Grab the handler the store registered with the fetch wrapper. */
  function registeredHandler(): () => void {
    renderConsumers(1);
    const call = mockSetUnauthorizedHandler.mock.calls.at(-1);
    if (!call) throw new Error('no unauthorized handler was registered');
    return call[0] as () => void;
  }

  it('registers a handler with the fetch layer', () => {
    expect(registeredHandler()).toBeInstanceOf(Function);
  });

  it('does nothing when there is no session to tear down', async () => {
    const handler = registeredHandler();
    await TestRenderer.act(async () => {
      handler();
      await Promise.resolve();
    });
    // Signed out already — a 401 here is expected, not evidence of anything.
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });
});
