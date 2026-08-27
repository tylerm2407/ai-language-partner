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

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));
jest.mock('../lib/auth-links', () => ({ RESET_PASSWORD_REDIRECT: 'x://reset' }));
jest.mock('../lib/read-cache', () => ({ clearReadCache: jest.fn().mockResolvedValue(undefined) }));

import { useAuth, __resetAuthStoreForTests } from './useAuth';

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
