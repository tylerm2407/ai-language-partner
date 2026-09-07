import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { handleStart } from './start.ts';

/**
 * These tests exist for the class of bug the compiler cannot see.
 *
 * Every RPC name, counter name and column name in start.ts is a STRING. TypeScript
 * will happily let you call `consume_daily_quota` with counter `'tutor_second'`,
 * or read `fluenci_user_today` with the wrong parameter name, and the first
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
  monthlyOk?: boolean;
  dailyOk?: boolean;
  sessionInsertFails?: boolean;
} = {}) {
  const rpcCalls: RpcCall[] = [];
  const tier = opts.tier === undefined ? 'premium' : opts.tier;
  const limits = opts.limits ?? {
    dailyTutorMinutes: 30, monthlyTutorCents: 800, dailyChatCards: 30,
    dailyTextMessages: 50, dailyVoiceMinutes: 12,
  };

  const table = (name: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const m of ['select', 'eq', 'gte', 'in', 'order', 'limit', 'is', 'update']) {
      chain[m] = self;
    }
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
    chain.insert = () => chain;
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
      if (name === 'consume_monthly_quota') {
        return Promise.resolve({ data: opts.monthlyOk ?? true, error: null });
      }
      if (name === 'consume_daily_quota') {
        return Promise.resolve({ data: opts.dailyOk ?? true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };

  return { supabase, rpcCalls };
}

const request = {
  targetLanguage: 'es',
  nativeLanguage: 'en',
  level: 'intermediate',
  correctionMode: 'as_you_go' as const,
};
const env = { openaiKey: 'sk-test', safetySalt: 'salt' };

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
  assert(!rpcCalls.some((c) => c.name === 'consume_monthly_quota'));
  assert(!rpcCalls.some((c) => c.name === 'consume_daily_quota'));
});

Deno.test('the MONTHLY ceiling is reserved before the daily one', async () => {
  const { supabase, rpcCalls } = makeStub();
  stubMint(goodMint);
  try {
    await handleStart(supabase, 'user-1', request, env);
  } finally { restore(); }

  const monthlyAt = rpcCalls.findIndex((c) => c.name === 'consume_monthly_quota');
  const dailyAt = rpcCalls.findIndex((c) => c.name === 'consume_daily_quota');
  assert(monthlyAt > -1 && dailyAt > -1, 'both reservations must happen');
  // Monthly is the margin guarantee. A daily failure must not be able to strand
  // a monthly charge, which is only true if monthly goes first.
  assert(monthlyAt < dailyAt, 'monthly must be reserved before daily');
});

Deno.test('the counters and RPC parameter names are exactly right', async () => {
  const { supabase, rpcCalls } = makeStub();
  stubMint(goodMint);
  try {
    await handleStart(supabase, 'user-1', request, env);
  } finally { restore(); }

  const monthly = rpcCalls.find((c) => c.name === 'consume_monthly_quota');
  assertEquals(monthly?.params.p_counter, 'tutor_cents');
  const daily = rpcCalls.find((c) => c.name === 'consume_daily_quota');
  assertEquals(daily?.params.p_counter, 'tutor_seconds');

  // These two genuinely differ in production and getting one wrong reads the
  // wrong row silently.
  const today = rpcCalls.find((c) => c.name === 'fluenci_user_today');
  assert(today && 'p_uid' in today.params, 'fluenci_user_today takes p_uid');
  const month = rpcCalls.find((c) => c.name === 'fluenci_user_month');
  assert(month && 'p_user_id' in month.params, 'fluenci_user_month takes p_user_id');
});

Deno.test('a failed mint refunds BOTH reservations', async () => {
  // The single most important error path in the function: we have charged for a
  // session that will not happen.
  const { supabase, rpcCalls } = makeStub();
  stubMint(() => new Response('upstream on fire', { status: 500 }));
  try {
    const res = await handleStart(supabase, 'user-1', request, env);
    assertEquals(res.status, 502);
    assertEquals(res.body.code, 'TUTOR_UNAVAILABLE');
  } finally { restore(); }

  const refundedSeconds = rpcCalls.find(
    (c) => c.name === 'refund_daily_quota' && c.params.p_counter === 'tutor_seconds');
  const refundedCents = rpcCalls.find(
    (c) => c.name === 'refund_monthly_quota' && c.params.p_counter === 'tutor_cents');
  assert(refundedSeconds, 'daily seconds must be refunded when the mint fails');
  assert(refundedCents, 'monthly cents must be refunded when the mint fails');
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
  assert(rpcCalls.some((c) => c.name === 'refund_daily_quota'));
  assert(rpcCalls.some((c) => c.name === 'refund_monthly_quota'));
});

Deno.test('a daily refusal refunds the monthly reservation it already took', async () => {
  const { supabase, rpcCalls } = makeStub({ dailyOk: false });
  const res = await handleStart(supabase, 'user-1', request, env);
  assertEquals(res.status, 429);
  assertEquals(res.body.code, 'DAILY_TUTOR_LIMIT_REACHED');
  assert(
    rpcCalls.some((c) => c.name === 'refund_monthly_quota' && c.params.p_counter === 'tutor_cents'),
    'the monthly charge must be given back when the daily check refuses',
  );
});

Deno.test('a monthly refusal takes nothing and refunds nothing', async () => {
  const { supabase, rpcCalls } = makeStub({ monthlyOk: false });
  const res = await handleStart(supabase, 'user-1', request, env);
  assertEquals(res.status, 429);
  assertEquals(res.body.code, 'MONTHLY_TUTOR_BUDGET_REACHED');
  assert(!rpcCalls.some((c) => c.name === 'consume_daily_quota'), 'must not reserve daily after a monthly refusal');
  assert(!rpcCalls.some((c) => c.name.startsWith('refund_')), 'nothing was taken, so nothing to refund');
});

Deno.test('a failed session insert refunds too', async () => {
  const { supabase, rpcCalls } = makeStub({ sessionInsertFails: true });
  const res = await handleStart(supabase, 'user-1', request, env);
  assertEquals(res.status, 500);
  assert(rpcCalls.some((c) => c.name === 'refund_daily_quota'));
  assert(rpcCalls.some((c) => c.name === 'refund_monthly_quota'));
});

Deno.test('a successful start never returns the instructions or the voice', async () => {
  // CLAUDE.md section 6: model and system prompts must not be exposed. The
  // whole point of minting server-side is that the prompt stays here.
  const { supabase } = makeStub();
  stubMint(goodMint);
  try {
    const res = await handleStart(supabase, 'user-1', request, env);
    assertEquals(res.status, 200);
    assertEquals(res.body.clientSecret, 'ek_abc123');
    assert(!('instructions' in res.body), 'instructions must never reach the client');
    assert(!('voice' in res.body), 'the voice id must never reach the client');
    assert(!('turn_detection' in res.body));
    const serialised = JSON.stringify(res.body);
    assert(!serialised.includes('CORRECTING mode'), 'prompt text leaked into the response');
  } finally { restore(); }
});
