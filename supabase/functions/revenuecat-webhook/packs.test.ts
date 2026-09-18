import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { applyPackEvent, classifyPackEvent, packTransactionId } from './packs.ts';
import { classifyEvent } from './tier.ts';
import { TUTOR_PACKS } from '../_shared/tutor-packs.ts';

const PACK = TUTOR_PACKS[1]; // fluenci_tutor_pack_50

interface RpcCall { name: string; params: Record<string, unknown> }

function stub(result: { data?: unknown; error?: { message: string } } = {}) {
  const calls: RpcCall[] = [];
  const supabase = {
    rpc: (name: string, params: Record<string, unknown>) => {
      calls.push({ name, params });
      return Promise.resolve({
        data: result.data ?? { status: 'granted', balanceSeconds: PACK.seconds },
        error: result.error ?? null,
      });
    },
  };
  return { supabase, calls };
}

Deno.test('a subscription product is not a pack event', () => {
  assertEquals(classifyPackEvent('INITIAL_PURCHASE', 'fluenci_vip_yearly'), null);
  assertEquals(classifyPackEvent('RENEWAL', null), null);
});

Deno.test('a pack purchase grants, a pack cancellation claws back', () => {
  assertEquals(classifyPackEvent('NON_RENEWING_PURCHASE', PACK.productId)?.kind, 'grant');
  assertEquals(classifyPackEvent('CANCELLATION', PACK.productId)?.kind, 'refund');
});

Deno.test('any other event on a pack product changes nothing', () => {
  // The important word is "nothing". Falling through to classifyEvent is the
  // failure this branch exists to prevent.
  for (const type of ['TEST', 'EXPIRATION', 'BILLING_ISSUE', 'SOMETHING_NEW']) {
    assertEquals(classifyPackEvent(type, PACK.productId)?.kind, 'ignore', type);
  }
});

Deno.test('refunding a pack can never revoke a subscription', () => {
  // This is the second disaster the branch prevents, and it is worse than the
  // first: classifyEvent reads a refund `cancel_reason` as "access has ended",
  // so without the interception a refunded $10.99 pack would cancel a $29.99
  // subscription. Pin BOTH halves: that classifyEvent really would do this,
  // and that the pack branch catches it first.
  const wouldHaveRevoked = classifyEvent('CANCELLATION', [], PACK.productId, 'CUSTOMER_SUPPORT');
  assertEquals(wouldHaveRevoked, { tier: 'starter', isActive: false, cancelAtPeriodEnd: false });
  assertEquals(classifyPackEvent('CANCELLATION', PACK.productId)?.kind, 'refund');
});

Deno.test('the ledger is keyed on the store transaction, falling back to the event id', () => {
  assertEquals(packTransactionId({ transaction_id: 'txn_1', id: 'evt_1' }), 'txn_1');
  assertEquals(packTransactionId({ id: 'evt_1' }), 'evt_1');
  assertEquals(packTransactionId({}), null);
  assertEquals(packTransactionId({ transaction_id: '' , id: '' }), null);
  assertEquals(packTransactionId({ transaction_id: 'x'.repeat(256), id: 'evt_1' }), 'evt_1');
});

Deno.test('a grant sends the seconds from OUR table, not from the event', async () => {
  // The client names a product; the store charges for it; the seconds come
  // from tutor-packs.ts. An event claiming its own size grants nothing extra.
  const { supabase, calls } = stub();
  const action = classifyPackEvent('NON_RENEWING_PURCHASE', PACK.productId)!;
  const res = await applyPackEvent(
    supabase,
    'user-1',
    { transaction_id: 'txn_1', id: 'evt_1', seconds: 999999 },
    action,
  );
  assertEquals(res.status, 200);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].name, 'grant_tutor_credit_lot');
  assertEquals(calls[0].params.p_seconds, PACK.seconds);
  assertEquals(calls[0].params.p_store_transaction_id, 'txn_1');
  assertEquals(calls[0].params.p_product_id, PACK.productId);
});

Deno.test('a failed grant asks RevenueCat to retry', async () => {
  // The learner has paid and is owed minutes; a retry can still deliver them.
  const { supabase } = stub({ error: { message: 'db on fire' } });
  const action = classifyPackEvent('NON_RENEWING_PURCHASE', PACK.productId)!;
  const res = await applyPackEvent(supabase, 'user-1', { transaction_id: 'txn_1' }, action);
  assertEquals(res.status, 500);
});

Deno.test('an unkeyable pack event is acknowledged, not retried forever', async () => {
  // Retrying cannot conjure a transaction id, and 500 here would have
  // RevenueCat redelivering until it gave up.
  const { supabase, calls } = stub();
  const action = classifyPackEvent('NON_RENEWING_PURCHASE', PACK.productId)!;
  const res = await applyPackEvent(supabase, 'user-1', {}, action);
  assertEquals(res.status, 200);
  assertEquals(calls.length, 0, 'nothing may be granted without an idempotency key');
});

Deno.test('an ignored pack event touches no RPC at all', async () => {
  const { supabase, calls } = stub();
  const action = classifyPackEvent('TEST', PACK.productId)!;
  const res = await applyPackEvent(supabase, 'user-1', { transaction_id: 'txn_1' }, action);
  assertEquals(res.status, 200);
  assertEquals(calls.length, 0);
  assert(res.body.ignored === true);
});

Deno.test('a clawback calls the refund RPC and never the subscription path', async () => {
  const { supabase, calls } = stub({ data: { status: 'refunded', deficitAdded: 600 } });
  const action = classifyPackEvent('CANCELLATION', PACK.productId)!;
  const res = await applyPackEvent(supabase, 'user-1', { transaction_id: 'txn_1' }, action);
  assertEquals(res.status, 200);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].name, 'refund_tutor_credit_lot');
  assert(!calls.some((c) => c.name === 'apply_revenuecat_entitlement_event'));
});
