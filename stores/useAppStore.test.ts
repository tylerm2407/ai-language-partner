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
}));

import { effectiveTier } from './useAppStore';
import type { Subscription, SubscriptionTier } from '../types';

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
