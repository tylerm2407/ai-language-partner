import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  CHECKOUT_CANCEL_URL,
  CHECKOUT_SUCCESS_URL,
  customerSearchQuery,
  resolveCustomerOwnership,
} from './customer-ownership.ts';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

Deno.test('mapped customer is accepted only when Stripe metadata owns it', () => {
  assertEquals(resolveCustomerOwnership(USER_A, {
    id: 'cus_a',
    metadata: { supabase_user_id: USER_A },
  }, []), { kind: 'owned', customerId: 'cus_a' });

  assertEquals(resolveCustomerOwnership(USER_A, {
    id: 'cus_b',
    metadata: { supabase_user_id: USER_B },
  }, []), { kind: 'conflict' });
});

Deno.test('discovery accepts exactly one metadata-owned customer', () => {
  assertEquals(resolveCustomerOwnership(USER_A, null, [{
    id: 'cus_a',
    metadata: { supabase_user_id: USER_A },
  }]), { kind: 'owned', customerId: 'cus_a' });
});

Deno.test('ambiguous customer ownership fails closed', () => {
  assertEquals(resolveCustomerOwnership(USER_A, null, [
    { id: 'cus_1', metadata: { supabase_user_id: USER_A } },
    { id: 'cus_2', metadata: { supabase_user_id: USER_A } },
  ]), { kind: 'conflict' });
});

Deno.test('missing owned customer requests creation', () => {
  assertEquals(resolveCustomerOwnership(USER_A, null, []), { kind: 'create' });
});

Deno.test('checkout callbacks use the configured Fluenci scheme', () => {
  assertEquals(CHECKOUT_SUCCESS_URL, 'fluenci://subscription-success');
  assertEquals(CHECKOUT_CANCEL_URL, 'fluenci://subscription-cancel');
});

Deno.test('customer discovery uses Stripe metadata search syntax', () => {
  assertEquals(
    customerSearchQuery(USER_A),
    "metadata['supabase_user_id']:'" + USER_A + "'",
  );
});
