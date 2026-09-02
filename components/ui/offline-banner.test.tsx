/**
 * The banner used to get stuck. `NetInfo.addEventListener` only fires when
 * NetInfo's view CHANGES, so a false negative during app startup — which iOS
 * simulators produce regularly — was never corrected: the banner claimed
 * "You're offline" for the rest of the session while every request succeeded,
 * and only a full app restart cleared it.
 *
 * These tests pin the two things that fix it: reading the honest field, and
 * re-checking instead of trusting one bad reading forever.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const mockFetch = jest.fn();
const mockAddEventListener = jest.fn();
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: (...a: unknown[]) => mockFetch(...a),
    addEventListener: (...a: unknown[]) => mockAddEventListener(...a),
  },
}));

import { OfflineBanner, looksOffline } from './OfflineBanner';

/** Rendered banner text, or null when the banner is absent. */
function bannerText(tree: TestRenderer.ReactTestRenderer): string | null {
  const found = tree.root.findAll(
    (n) => typeof n.type === 'string' && /you're offline/i.test(
      (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? ''))
    ),
    { deep: true },
  );
  return found.length ? 'offline' : null;
}

type S = { isConnected: boolean | null; isInternetReachable: boolean | null };
const state = (isConnected: S['isConnected'], isInternetReachable: S['isInternetReachable']) =>
  ({ isConnected, isInternetReachable }) as never;

describe('looksOffline', () => {
  it('trusts isInternetReachable over isConnected', () => {
    // The captive-portal / simulator case: an interface exists but nothing
    // is reachable. This is genuinely offline for the learner.
    expect(looksOffline(state(true, false))).toBe(true);
    // And the inverse: the interface reads false but traffic flows. This is
    // the false negative that used to stick.
    expect(looksOffline(state(false, true))).toBe(false);
  });

  it('never announces offline for an unknown state', () => {
    // NetInfo uses null for "don't know yet". Accusing the learner's
    // connection on no evidence is worse than staying quiet.
    expect(looksOffline(state(null, null))).toBe(false);
    expect(looksOffline(state(true, null))).toBe(false);
  });

  it('falls back to isConnected only when reachability is unknown', () => {
    expect(looksOffline(state(false, null))).toBe(true);
  });
});

describe('OfflineBanner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    mockAddEventListener.mockReset().mockReturnValue(() => {});
  });
  afterEach(() => jest.useRealTimers());

  it('seeds from an explicit read instead of waiting for a change event', async () => {
    mockFetch.mockResolvedValue(state(false, false));
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => { tree = TestRenderer.create(<OfflineBanner />); });
    expect(mockFetch).toHaveBeenCalled();
    expect(bannerText(tree)).toBe('offline');
  });

  it('recovers from a stuck false negative without an app restart', async () => {
    // Startup reports offline...
    mockFetch.mockResolvedValueOnce(state(false, false));
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => { tree = TestRenderer.create(<OfflineBanner />); });
    expect(bannerText(tree)).toBe('offline');

    // ...and NetInfo never fires another event, because from its point of
    // view nothing changed. Before the fix the banner stayed forever.
    mockFetch.mockResolvedValue(state(true, true));
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(bannerText(tree)).toBeNull();
  });

  it('does not poll while online', async () => {
    mockFetch.mockResolvedValue(state(true, true));
    await act(async () => { TestRenderer.create(<OfflineBanner />); });
    const afterSeed = mockFetch.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    // The recheck timer exists but must be a no-op while online, so the
    // healthy path costs nothing.
    expect(mockFetch.mock.calls.length).toBe(afterSeed);
  });
});
