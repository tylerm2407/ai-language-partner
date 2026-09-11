import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { revenueCatAnalyticsEvents } from './analytics.ts';

const BASE = {
  id: 'evt-1',
  app_user_id: '123e4567-e89b-12d3-a456-426614174000',
  environment: 'PRODUCTION',
  event_timestamp_ms: 1_700_000_000_000,
  product_id: 'fluenci_premium_yearly',
  currency: 'USD',
  price_in_purchased_currency: 49.99,
};

Deno.test('initial purchase becomes persisted purchase and subscription events', () => {
  const events = revenueCatAnalyticsEvents({ ...BASE, type: 'INITIAL_PURCHASE' }, 'premium');
  assertEquals(events.map((event) => event.event), ['purchase_completed', 'subscription_started']);
  assertEquals(events[0].insertId, 'revenuecat:evt-1:purchase_completed');
  assertEquals(events[0].properties, {
    provider: 'revenuecat',
    providerEventType: 'INITIAL_PURCHASE',
    tier: 'premium',
    environment: 'production',
    term: 'annual',
    currency: 'USD',
    amount: 49.99,
  });
});

Deno.test('renewal carries monetary and renewal history', () => {
  const events = revenueCatAnalyticsEvents({ ...BASE, type: 'RENEWAL', renewal_number: 3 }, 'premium');
  assertEquals(events.map((event) => event.event), ['purchase_completed', 'subscription_renewed']);
  assertEquals(events[0].properties?.renewalNumber, 3);
});

Deno.test('cancellation and expiration stay distinct', () => {
  assertEquals(
    revenueCatAnalyticsEvents({ ...BASE, type: 'CANCELLATION' }, 'premium').map((event) => event.event),
    ['subscription_cancelled'],
  );
  assertEquals(
    revenueCatAnalyticsEvents({ ...BASE, type: 'EXPIRATION' }, 'starter').map((event) => event.event),
    ['subscription_expired'],
  );
});

Deno.test('sandbox billing never contaminates production analytics', () => {
  assertEquals(
    revenueCatAnalyticsEvents({ ...BASE, type: 'INITIAL_PURCHASE', environment: 'SANDBOX' }, 'premium'),
    [],
  );
});

Deno.test('invalid timestamps are refused so retries keep one identity', () => {
  assertEquals(
    revenueCatAnalyticsEvents({ ...BASE, type: 'INITIAL_PURCHASE', event_timestamp_ms: NaN }, 'premium'),
    [],
  );
});
