import { assertEquals, assertRejects } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  fetchRevenueCatSubscription,
  subscriptionFromSubscriber,
  transferUserIds,
} from './reconcile.ts';

const A = 'c56a4180-65aa-42ec-a945-5fd21dec0538';
const B = '8f14e45f-ea45-4f6f-9f84-7dbbe0f5f2bb';

Deno.test('transferUserIds includes valid source and destination UUIDs once', () => {
  assertEquals(transferUserIds({
    transferred_from: [A, '$RCAnonymousID:old', A],
    transferred_to: [B, '$RCAnonymousID:new'],
  }), [A, B]);
});

Deno.test('transferUserIds rejects malformed transfer fields', () => {
  assertEquals(transferUserIds({ transferred_from: A, transferred_to: null }), []);
});

Deno.test('subscriptionFromSubscriber chooses highest active tier and latest expiry', () => {
  const result = subscriptionFromSubscriber(A, { subscriber: { entitlements: {
    basic: { expires_date: '2030-01-01T00:00:00.000Z', product_identifier: 'fluenci_basic_yearly' },
    vip: { expires_date: '2031-01-01T00:00:00.000Z', product_identifier: 'fluenci_vip_yearly' },
    premium: { expires_date: '2020-01-01T00:00:00.000Z', product_identifier: 'fluenci_premium_yearly' },
  } } }, Date.parse('2029-01-01T00:00:00.000Z'));
  assertEquals(result, {
    userId: A,
    tier: 'vip',
    isActive: true,
    subscriptionStatus: 'active',
    currentPeriodEnd: '2031-01-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
  });
});

Deno.test('subscriptionFromSubscriber revokes when no entitlement is active', () => {
  assertEquals(subscriptionFromSubscriber(A, { subscriber: { entitlements: {
    premium: { expires_date: '2020-01-01T00:00:00.000Z' },
  } } }, Date.parse('2029-01-01T00:00:00.000Z')), {
    userId: A,
    tier: 'starter',
    isActive: false,
    subscriptionStatus: 'inactive',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  });
});

Deno.test('subscriptionFromSubscriber fails closed on an unmapped active entitlement', () => {
  let message = '';
  try {
    subscriptionFromSubscriber(A, { subscriber: { entitlements: {
      plus: { expires_date: null },
    } } });
  } catch (error) {
    message = error instanceof Error ? error.message : '';
  }
  assertEquals(message, 'active RevenueCat entitlement does not map to a Fluenci tier');
});

Deno.test('subscriptionFromSubscriber supports lifetime entitlements', () => {
  const result = subscriptionFromSubscriber(A, { subscriber: { entitlements: {
    premium: { expires_date: null, product_identifier: 'fluenci_premium_lifetime' },
  } } });
  assertEquals(result.isActive, true);
  assertEquals(result.tier, 'premium');
  assertEquals(result.currentPeriodEnd, null);
});

Deno.test('fetchRevenueCatSubscription authenticates and fails closed on API errors', async () => {
  let header = '';
  const okFetcher = ((_url: string | URL | Request, init?: RequestInit) => {
    header = new Headers(init?.headers).get('authorization') ?? '';
    return Promise.resolve(new Response(JSON.stringify({ subscriber: { entitlements: {} } })));
  }) as typeof fetch;
  await fetchRevenueCatSubscription(A, 'secret-key', okFetcher);
  assertEquals(header, 'Bearer secret-key');

  const badFetcher = (() => Promise.resolve(new Response('unavailable', { status: 503 }))) as typeof fetch;
  await assertRejects(
    () => fetchRevenueCatSubscription(A, 'secret-key', badFetcher),
    Error,
    'subscriber lookup failed (503)',
  );
});
