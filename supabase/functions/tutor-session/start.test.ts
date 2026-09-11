import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { handleStart } from './start.ts';

/**
 * These tests exist for the class of bug the compiler cannot see.
 *
 * Every RPC name, parameter name and column name in start.ts is a STRING.
 * TypeScript will happily let you call `reserve_tutor_session` with the wrong
 * parameter name, or read `fluenci_user_today` with the wrong one, and the first
 * symptom would be a learner charged wrongly in production. Two such traps have
 * already been hit in this feature: `fluenci_user_today` takes `p_uid` while
 * `fluenci_user_month` takes `p_user_id`, and `isValidLanguage` lives in
 * validation.ts rather than language.ts.
 *
 * So the stub records the exact RPC names and arguments, and the assertions
 * pin them.
 */

interface RpcCall { name: string; params: Record<string, unknown> }

function makeStub(opts: {
  tier?: string | null;
  limits?: Record<string, number>;
  /** What `reserve_tutor_session` answers. Defaults to 'reserved'. */
  reserve?: 'reserved' | 'daily_limit' | 'monthly_limit' | 'active_session';
  sessionInsertFails?: boolean;
} = {}) {
  const rpcCalls: RpcCall[] = [];
  const deletes: string[] = [];
  let inserted: Record<string, unknown> | null = null;
  const tier = opts.tier === undefined ? 'premium' : opts.tier;
  const limits = opts.limits ?? {
    dailyTutorMinutes: 30, monthlyTutorCents: 800, dailyChatCards: 30,
    dailyTextMessages: 50, dailyVoiceMinutes: 12,
  };

  const table = (name: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const m of ['select', 'gte', 'in', 'order', 'limit', 'is', 'update']) {
      chain[m] = self;
    }
    chain.eq = (_col: string, value: unknown) => {
      if (name === 'tutor_sessions' && deleting) deletes.push(String(value));
      return chain;
    };
    let deleting = false;
    chain.delete = () => { deleting = true; return chain; };
    chain.maybeSingle = () => {
      if (name === 'subscriptions') {
        return Promise.resolve({ data: tier ? { tier, is_active: true } : null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    };
    chain.single = () =>
      Promise.resolve(
        opts.sessionInsertFails
          ? { data: null, error: { message: 'insert exploded' } }
          : { data: { id: 'session-1' }, error: null },
      );
    chain.insert = (row: Record<string, unknown>) => { inserted = row; return chain; };
    chain.then = undefined;
    return chain;
  };

  const supabase = {
    from: (name: string) => table(name),
    rpc: (name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ name, params });
      if (name === 'get_effective_limits') return Promise.resolve({ data: limits, error: null });
      if (name === 'fluenci_user_today') return Promise.resolve({ data: '2026-09-06', error: null });
      if (name === 'fluenci_user_month') return Promise.resolve({ data: '2026-09-01', error: null });
      if (name === 'reserve_tutor_session') {
        return Promise.resolve({ data: { status: opts.reserve ?? 'reserved' }, error: null });
      }
      if (name === 'settle_tutor_session') {
        return Promise.resolve({
          data: {
            status: 'settled',
            observedSeconds: params.p_observed_seconds,
            refundSeconds: params.p_refund_seconds,
            refundCents: params.p_refund_cents,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };

  return { supabase, rpcCalls, deletes, inserted: () => inserted };
}

const request = {
  targetLanguage: 'es',
  nativeLanguage: 'en',
  level: 'intermediate',
  correctionMode: 'as_you_go' as const,
};
const env = { openaiKey: 'sk-test', safetySalt: 'salt', stashKey: () => Promise.resolve() };

const realFetch = globalThis.fetch;
function stubMint(handler: () => Response | Promise<Response>) {
  globalThis.fetch = (() => Promise.resolve(handler())) as unknown as typeof fetch;
}
function goodMint() {
  return new Response(JSON.stringify({ value: 'ek_abc123', expires_at: 1234 }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
function restore() { globalThis.fetch = realFetch; }

Deno.test('a free-tier learner is walled before any money moves', async () => {
  const { supabase, rpcCalls } = makeStub({ tier: null, limits: { dailyTutorMinutes: 0, monthlyTutorCents: 0, dailyChatCards: 3 } });
  const res = await handleStart(supabase, 'user-1', request, env);
  assertEquals(res.status, 403);
  assertEquals(res.body.code, 'TUTOR_NOT_ENTITLED');
  // Nothing was reserved, so nothing needs refunding.
  assert(!rpcCalls.some((c) => c.name === 'reserve_tutor_session'));
  assert(!rpcCalls.some((c) => c.name === 'settle_tutor_session'));
});

Deno.test('both ceilings are reserved in ONE transaction, after the row exists', async () => {
  const { supabase, rpcCalls, inserted } = makeStub();
  stubMint(goodMint);
  try {
    await handleStart(supabase, 'user-1', request, env);
  } finally { restore(); }

  const reserves = rpcCalls.filter((c) => c.name === 'reserve_tutor_session');
  assertEquals(reserves.length, 1, 'exactly one reservation RPC');
  // The row is inserted first so the ledger has something to lock and can
  // remember which day and month it charged.
  assert(inserted(), 'the session row must be inserted before the reservation');
  assertEquals(reserves[0].params.p_session_id, 'session-1');
  assertEquals(reserves[0].params.p_user_id, 'user-1');
  // Minutes in, SECONDS out: the ledger counts tutor_seconds.
  assertEquals(reserves[0].params.p_daily_limit, 30 * 60);
  assertEquals(reserves[0].params.p_monthly_limit, 800);
  // The legacy two-step is gone for good.
  assert(!rpcCalls.some((c) => c.name === 'consume_monthly_quota'));
  assert(!rpcCalls.some((c) => c.name === 'consume_daily_quota'));
});

Deno.test('the meter RPC parameter names are exactly right', async () => {
  const { supabase, rpcCalls } = makeStub();
  stubMint(goodMint);
  try {
    await handleStart(supabase, 'user-1', request, env);
  } finally { restore(); }

  // These two genuinely differ in production and getting one wrong reads the
  // wrong row silently.
  const today = rpcCalls.find((c) => c.name === 'fluenci_user_today');
  assert(today && 'p_uid' in today.params, 'fluenci_user_today takes p_uid');
  const month = rpcCalls.find((c) => c.name === 'fluenci_user_month');
  assert(month && 'p_user_id' in month.params, 'fluenci_user_month takes p_user_id');
});

Deno.test('a failed mint refunds the whole reservation', async () => {
  // The single most important error path in the function: we have charged for a
  // session that will not happen.
  const { supabase, rpcCalls, inserted } = makeStub();
  stubMint(() => new Response('upstream on fire', { status: 500 }));
  try {
    const res = await handleStart(supabase, 'user-1', request, env);
    assertEquals(res.status, 502);
    assertEquals(res.body.code, 'TUTOR_UNAVAILABLE');
  } finally { restore(); }

  // One settlement with ZERO observed seconds gives back every second and
  // every cent of the grant, in the same transaction.
  const settle = rpcCalls.find((c) => c.name === 'settle_tutor_session');
  assert(settle, 'the reservation must be settled back when the mint fails');
  const row = inserted()!;
  assertEquals(settle.params.p_session_id, 'session-1');
  assertEquals(settle.params.p_observed_seconds, 0);
  assertEquals(settle.params.p_refund_seconds, row.granted_seconds);
  assertEquals(settle.params.p_refund_cents, row.granted_cents);
});

Deno.test('a mint that returns no secret is treated as a failure, not a session', async () => {
  // Handing back an undefined token would cost the learner a round trip to
  // discover, having already been charged.
  const { supabase, rpcCalls } = makeStub();
  stubMint(() => new Response(JSON.stringify({ nothing: 'useful' }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }));
  try {
    const res = await handleStart(supabase, 'user-1', request, env);
    assertEquals(res.status, 502);
  } finally { restore(); }
  assert(rpcCalls.some((c) => c.name === 'settle_tutor_session'));
});

Deno.test('a daily refusal takes nothing: the row is removed and nothing is settled', async () => {
  const { supabase, rpcCalls, deletes } = makeStub({ reserve: 'daily_limit' });
  const res = await handleStart(supabase, 'user-1', request, env);
  assertEquals(res.status, 429);
  assertEquals(res.body.code, 'DAILY_TUTOR_LIMIT_REACHED');
  // The RPC refused under its own locks, so no counter moved and there is
  // nothing to refund — only an unreserved row to tidy away.
  assert(!rpcCalls.some((c) => c.name === 'settle_tutor_session'));
  assertEquals(deletes, ['session-1']);
});

Deno.test('a monthly refusal takes nothing either', async () => {
  const { supabase, rpcCalls, deletes } = makeStub({ reserve: 'monthly_limit' });
  const res = await handleStart(supabase, 'user-1', request, env);
  assertEquals(res.status, 429);
  assertEquals(res.body.code, 'MONTHLY_TUTOR_BUDGET_REACHED');
  assert(!rpcCalls.some((c) => c.name === 'settle_tutor_session'));
  assertEquals(deletes, ['session-1']);
});

Deno.test('a second open session is refused with 409, not charged', async () => {
  const { supabase, rpcCalls, deletes } = makeStub({ reserve: 'active_session' });
  const res = await handleStart(supabase, 'user-1', request, env);
  assertEquals(res.status, 409);
  assertEquals(res.body.code, 'TUTOR_SESSION_ACTIVE');
  assert(!rpcCalls.some((c) => c.name === 'settle_tutor_session'));
  assertEquals(deletes, ['session-1']);
});

Deno.test('a failed session insert happens before any money moves', async () => {
  const { supabase, rpcCalls } = makeStub({ sessionInsertFails: true });
  const res = await handleStart(supabase, 'user-1', request, env);
  assertEquals(res.status, 500);
  assert(!rpcCalls.some((c) => c.name === 'reserve_tutor_session'), 'no row, no reservation');
  assert(!rpcCalls.some((c) => c.name === 'settle_tutor_session'), 'nothing to refund');
});

Deno.test('a successful start never returns the instructions or the voice', async () => {
  // CLAUDE.md section 6: model and system prompts must not be exposed. The
  // whole point of minting server-side is that the prompt stays here.
  const { supabase } = makeStub();
  stubMint(goodMint);
  try {
    const res = await handleStart(supabase, 'user-1', request, env);
    assertEquals(res.status, 200);
    // The ephemeral key stays server-side (migration 113): the device connects
    // through the `connect` action, never with a credential of its own.
    assert(!('clientSecret' in res.body), 'the ephemeral key must never reach the client');
    assert(!JSON.stringify(res.body).includes('ek_abc123'), 'the ephemeral key leaked into the response');
    assert(!('instructions' in res.body), 'instructions must never reach the client');
    assert(!('voice' in res.body), 'the voice id must never reach the client');
    assert(!('turn_detection' in res.body));
    const serialised = JSON.stringify(res.body);
    assert(!serialised.includes('CORRECTING mode'), 'prompt text leaked into the response');
  } finally { restore(); }
});
