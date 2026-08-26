/**
 * Tests for `effectiveTier` — the function the hard paywall gate calls.
 *
 * This is the fix for the failure mode where a learner paid, the store
 * confirmed the purchase, and the app sent them straight back to the paywall
 * because `subscriptions.tier` still said `starter`: that row is written only
 * by the revenuecat-webhook edge function, which is a network round-trip away
 * and gives up after five retries. Gating on the row alone means a lost
 * webhook is indistinguishable from never having paid.
 *
 * The rule under test is "whichever source grants more", in both directions —
 * the entitlement must be able to open the gate before the row catches up, and
 * the row must not be dragged down by an SDK that hasn't woken up yet.
 *
 * The module is mocked at its data-layer boundary so importing the store does
 * not pull in the Supabase client.
 */
jest.mock('../lib/supabase-queries', () => ({
  fetchProfile: jest.fn(),
  fetchTodayStats: jest.fn(),
  fetchSubscription: jest.fn(),
  fetchReviewItemCount: jest.fn(),
  fetchUserRoles: jest.fn(),
  fetchHasCompletedLesson: jest.fn(),
  fetchHasAiConversation: jest.fn(),
}));

import * as queries from '../lib/supabase-queries';
import { effectiveTier, useAppStore } from './useAppStore';
import type { Subscription, SubscriptionTier, UserProfile } from '../types';

function row(tier: SubscriptionTier): Subscription {
  return {
    id: 'sub-1',
    userId: 'u1',
    tier,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    isActive: tier !== 'starter',
    cancelAtPeriodEnd: false,
  };
}

describe('effectiveTier', () => {
  it('is starter when neither source knows anything', () => {
    expect(effectiveTier(null, null)).toBe('starter');
  });

  it('opens the gate on the entitlement while the webhook is still in flight', () => {
    // The exact shape of the bug: purchase confirmed by the store, no row yet.
    expect(effectiveTier(null, 'premium')).toBe('premium');
    expect(effectiveTier(row('starter'), 'premium')).toBe('premium');
  });

  it('keeps the server row when the SDK has not reported yet', () => {
    // Cold start on an entitled device: the row loads before CustomerInfo.
    expect(effectiveTier(row('vip'), null)).toBe('vip');
    expect(effectiveTier(row('vip'), 'starter')).toBe('vip');
  });

  it('takes the higher tier when the two sources disagree', () => {
    // Mid-upgrade: the store has moved the learner up, the row still lags.
    expect(effectiveTier(row('basic'), 'vip')).toBe('vip');
    // And a stale local entitlement never downgrades a richer server row.
    expect(effectiveTier(row('vip'), 'basic')).toBe('vip');
  });

  it('agrees with itself once both sources have settled', () => {
    for (const tier of ['basic', 'premium', 'vip'] as SubscriptionTier[]) {
      expect(effectiveTier(row(tier), tier)).toBe(tier);
    }
  });

  it('treats an unrecognised tier as starter rather than throwing', () => {
    // A tier string the client does not know about must not rank above a real
    // one — an unknown value is not evidence of entitlement.
    expect(effectiveTier(row('legacy_pro' as SubscriptionTier), null)).toBe('starter');
    expect(effectiveTier(row('vip'), 'legacy_pro' as SubscriptionTier)).toBe('vip');
  });
});

/**
 * The onboarding reconciler needs to tell "no lesson" from "the read failed",
 * while the paywall needs a boolean that fails OPEN. Both come off the same
 * fetch, so the split between `hasCompletedLessonSignal` and
 * `hasCompletedLesson` is exactly the kind of thing a later tidy-up collapses.
 */
describe('loadUserData signals', () => {
  const profile = { userId: 'u1', targetLanguage: 'es' } as unknown as UserProfile;

  beforeEach(() => {
    jest.mocked(queries.fetchProfile).mockResolvedValue(profile);
    jest.mocked(queries.fetchTodayStats).mockResolvedValue(null);
    jest.mocked(queries.fetchSubscription).mockResolvedValue(null);
    jest.mocked(queries.fetchReviewItemCount).mockResolvedValue(0);
    jest.mocked(queries.fetchUserRoles).mockResolvedValue([]);
    useAppStore.getState().reset();
  });

  it('keeps the raw signal and the fail-open boolean apart when the read fails', async () => {
    jest.mocked(queries.fetchHasCompletedLesson).mockRejectedValue(new Error('offline'));
    jest.mocked(queries.fetchHasAiConversation).mockRejectedValue(new Error('offline'));

    await useAppStore.getState().loadUserData('u1');

    const s = useAppStore.getState();
    expect(s.hasCompletedLessonSignal).toBeNull();
    expect(s.hasAiConversationSignal).toBeNull();
    // Fail OPEN — a transient error must not lock the learner out.
    expect(s.hasCompletedLesson).toBe(false);
  });

  it('passes a successful read through to both', async () => {
    jest.mocked(queries.fetchHasCompletedLesson).mockResolvedValue(true);
    jest.mocked(queries.fetchHasAiConversation).mockResolvedValue(true);

    await useAppStore.getState().loadUserData('u1');

    const s = useAppStore.getState();
    expect(s.hasCompletedLessonSignal).toBe(true);
    expect(s.hasCompletedLesson).toBe(true);
    expect(s.hasAiConversationSignal).toBe(true);
  });

  it('reset clears the signals and the once-per-session reconciliation flag', () => {
    useAppStore.setState({
      hasCompletedLessonSignal: true,
      hasAiConversationSignal: true,
      reconciledUserId: 'u1',
    });
    useAppStore.getState().reset();
    const s = useAppStore.getState();
    expect(s.hasCompletedLessonSignal).toBeNull();
    expect(s.hasAiConversationSignal).toBeNull();
    expect(s.reconciledUserId).toBeNull();
  });
});

/**
 * The due-card badge is store state that four different paths can invalidate:
 * a review submit, the lesson warm-up's direct SRS upsert, an offline-queue
 * replay, and simply the clock. Home and the learn page therefore re-read it
 * on focus (`hooks/useReviewCountSync`), which puts a refresh on every tab
 * switch — so the refresh has to be single-flight, or a burst of identical
 * count queries can resolve out of order and the older reply re-shows a badge
 * the learner just cleared.
 */
describe('refreshReviewCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.getState().reset();
  });

  it('writes the fetched count into the store', async () => {
    jest.mocked(queries.fetchReviewItemCount).mockResolvedValue(3);
    await useAppStore.getState().refreshReviewCount('u1');
    expect(useAppStore.getState().reviewCount).toBe(3);
  });

  it('collapses concurrent refreshes for the same user into one query', async () => {
    jest.mocked(queries.fetchReviewItemCount).mockResolvedValue(0);
    const { refreshReviewCount } = useAppStore.getState();

    await Promise.all([
      refreshReviewCount('u1'),
      refreshReviewCount('u1'),
      refreshReviewCount('u1'),
    ]);

    expect(queries.fetchReviewItemCount).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().reviewCount).toBe(0);
  });

  it('releases the slot so a later refresh still sees new cards', async () => {
    jest.mocked(queries.fetchReviewItemCount).mockResolvedValue(0);
    await useAppStore.getState().refreshReviewCount('u1');
    jest.mocked(queries.fetchReviewItemCount).mockResolvedValue(2);
    await useAppStore.getState().refreshReviewCount('u1');
    expect(useAppStore.getState().reviewCount).toBe(2);
  });

  it('keeps the previous count when the read fails', async () => {
    jest.mocked(queries.fetchReviewItemCount).mockResolvedValue(4);
    await useAppStore.getState().refreshReviewCount('u1');

    jest.mocked(queries.fetchReviewItemCount).mockRejectedValue(new Error('offline'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await useAppStore.getState().refreshReviewCount('u1');
    spy.mockRestore();

    // Not zero: "all caught up" is a claim, and a network blip is not evidence.
    expect(useAppStore.getState().reviewCount).toBe(4);
  });
});
