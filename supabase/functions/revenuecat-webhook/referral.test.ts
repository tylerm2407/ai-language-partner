// Run with: `deno test supabase/functions/revenuecat-webhook/referral.test.ts`

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { referralStoreEventArgs } from './referral.ts';

const USER = '11111111-1111-4111-8111-111111111111';

const purchase = {
  type: 'INITIAL_PURCHASE',
  store: 'APP_STORE',
  environment: 'PRODUCTION',
  original_transaction_id: '2000000123456789',
  product_id: 'fluenci_premium_monthly',
  period_type: 'NORMAL',
  price: 9.99,
  expiration_at_ms: Date.UTC(2026, 9, 17),
};

Deno.test('referralStoreEventArgs: lifts every field off a purchase', () => {
  assertEquals(referralStoreEventArgs(purchase, USER, 'evt_1', false), {
    p_user_id: USER,
    p_event_id: 'evt_1',
    p_event_type: 'INITIAL_PURCHASE',
    p_store: 'APP_STORE',
    p_environment: 'PRODUCTION',
    p_original_transaction_id: '2000000123456789',
    p_product_id: 'fluenci_premium_monthly',
    p_period_type: 'NORMAL',
    p_price: 9.99,
    p_expires_at: '2026-10-17T00:00:00.000Z',
    p_is_revocation: false,
  });
});

Deno.test('referralStoreEventArgs: no store means no call', () => {
  assertEquals(referralStoreEventArgs({ ...purchase, store: undefined }, USER, 'evt_1', false), null);
  assertEquals(referralStoreEventArgs({ ...purchase, store: '' }, USER, 'evt_1', false), null);
});

Deno.test('referralStoreEventArgs: malformed optional fields become null, never guessed', () => {
  const args = referralStoreEventArgs(
    { ...purchase, price: 'free', expiration_at_ms: 'soon', original_transaction_id: 42, period_type: null },
    USER,
    'evt_2',
    false,
  );
  assertEquals(args?.p_price, null);
  assertEquals(args?.p_expires_at, null);
  assertEquals(args?.p_original_transaction_id, null);
  assertEquals(args?.p_period_type, null);
});

Deno.test('referralStoreEventArgs: a trial and a promo grant carry their period type through', () => {
  // The RPC is what refuses them; the mapper must not drop the signal.
  assertEquals(referralStoreEventArgs({ ...purchase, period_type: 'TRIAL', price: 0 }, USER, 'e', false)?.p_period_type, 'TRIAL');
  assertEquals(referralStoreEventArgs({ ...purchase, store: 'PROMOTIONAL', price: 0 }, USER, 'e', false)?.p_store, 'PROMOTIONAL');
});

Deno.test('referralStoreEventArgs: revocation flag passes through', () => {
  const args = referralStoreEventArgs({ ...purchase, type: 'CANCELLATION' }, USER, 'evt_3', true);
  assertEquals(args?.p_is_revocation, true);
  assertEquals(args?.p_event_type, 'CANCELLATION');
});

Deno.test('referralStoreEventArgs: oversized strings are refused', () => {
  const args = referralStoreEventArgs({ ...purchase, product_id: 'x'.repeat(500) }, USER, 'e', false);
  assertEquals(args?.p_product_id, null);
});
