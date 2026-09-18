import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { getEffectiveLimits, getPlanLimits, PLAN_LIMITS, type PlanTier } from './plan-limits.ts';

/** A client whose `get_effective_limits` RPC answers with `data` / `error`. */
function rpcClient(data: unknown, error: unknown = null) {
  return {
    rpc: (name: string, args: Record<string, unknown>) => {
      assertEquals(name, 'get_effective_limits');
      assertEquals(args, { p_user_id: 'u1' });
      return Promise.resolve({ data, error });
    },
  };
}

// ─── The ladder (migration 147) ─────────────────────────────────────────────

Deno.test('maxLanguages: free keeps one language, every paid tier is the 9999 sentinel', () => {
  assertEquals(PLAN_LIMITS.starter.maxLanguages, 1);
  for (const tier of ['basic', 'premium', 'vip'] as PlanTier[]) {
    assertEquals(PLAN_LIMITS[tier].maxLanguages, 9999, tier);
  }
});

Deno.test('maxLanguages: an unknown tier falls to the free allowance', () => {
  assertEquals(getPlanLimits('platinum').maxLanguages, 1);
});

// ─── getEffectiveLimits reads the RPC's merged value ────────────────────────
// The school merge itself is SQL — GREATEST(personal, COALESCE(school, 0)) —
// and its text is pinned against this file by lib/plan-matrix-parity.test.ts.
// What this file owns is carrying the merged number through, not re-deriving
// it, and failing closed when it is missing or malformed.

Deno.test('maxLanguages: a school contract grant reaches a free student', async () => {
  // Free personal 1, contract 3: GREATEST(1, 3) = 3 in the RPC.
  const limits = await getEffectiveLimits('u1', rpcClient({ maxLanguages: 3 }));
  assertEquals(limits.maxLanguages, 3);
});

Deno.test('maxLanguages: a smaller contract never downgrades a paid student', async () => {
  // Premium 9999, contract 2: GREATEST(9999, 2) = 9999 — the reason for the
  // sentinel rather than null.
  const limits = await getEffectiveLimits('u1', rpcClient({ maxLanguages: 9999 }), 'premium');
  assertEquals(limits.maxLanguages, 9999);
});

Deno.test('maxLanguages: read from a single-row array as well as an object', async () => {
  const limits = await getEffectiveLimits('u1', rpcClient([{ maxLanguages: 4 }]));
  assertEquals(limits.maxLanguages, 4);
});

Deno.test('maxLanguages: a missing key falls to the caller tier, else free', async () => {
  // An older get_effective_limits (pre-147) does not return the key.
  assertEquals((await getEffectiveLimits('u1', rpcClient({ dailyNewCards: 5 }))).maxLanguages, 1);
  assertEquals((await getEffectiveLimits('u1', rpcClient({ dailyNewCards: 20 }), 'basic')).maxLanguages, 9999);
});

Deno.test('maxLanguages: malformed values fail closed, never to unlimited', async () => {
  for (const bad of ['9999', 0, -1, 2.5, null, NaN, Infinity, true]) {
    const limits = await getEffectiveLimits('u1', rpcClient({ maxLanguages: bad }));
    assertEquals(limits.maxLanguages, 1, `value ${String(bad)}`);
  }
});

Deno.test('maxLanguages: an RPC error or empty answer falls to the tier floor', async () => {
  assertEquals((await getEffectiveLimits('u1', rpcClient(null, { message: 'boom' }))).maxLanguages, 1);
  assertEquals((await getEffectiveLimits('u1', rpcClient(null))).maxLanguages, 1);
  assertEquals((await getEffectiveLimits('u1', rpcClient([]))).maxLanguages, 1);
  assertEquals((await getEffectiveLimits('u1', rpcClient(null), 'vip')).maxLanguages, 9999);
});

Deno.test('getEffectiveLimits returns every PlanLimits key', async () => {
  // The dailyNewCards omission this mapper once shipped was a missing key that
  // only `deno check` saw. This catches the same class at test time, for any
  // key added to PlanLimits later.
  const limits = await getEffectiveLimits('u1', rpcClient({}));
  assertEquals(Object.keys(limits).sort(), Object.keys(PLAN_LIMITS.starter).sort());
});
