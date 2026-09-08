import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handleStart } from "./start.ts";

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

interface RpcCall {
  name: string;
  params: Record<string, unknown>;
}

function makeStub(opts: {
  tier?: string | null;
  limits?: Record<string, number>;
  monthlyOk?: boolean;
  dailyOk?: boolean;
  sessionInsertFails?: boolean;
  providerPrepareFails?: boolean;
} = {}) {
  const rpcCalls: RpcCall[] = [];
  const tier = opts.tier === undefined ? "premium" : opts.tier;
  const limits = opts.limits ?? {
    dailyTutorMinutes: 30,
    monthlyTutorCents: 800,
    dailyChatCards: 30,
    dailyTextMessages: 50,
    dailyVoiceMinutes: 12,
  };

  const table = (name: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (
      const m of [
        "select",
        "eq",
        "gte",
        "in",
        "order",
        "limit",
        "is",
        "update",
        "delete",
      ]
    ) {
      chain[m] = self;
    }
    chain.maybeSingle = () => {
      if (name === "subscriptions") {
        return Promise.resolve({
          data: tier ? { tier, is_active: true } : null,
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    };
    chain.single = () =>
      Promise.resolve(
        opts.sessionInsertFails
          ? { data: null, error: { message: "insert exploded" } }
          : { data: { id: "session-1" }, error: null },
      );
    chain.insert = () =>
      name === "tutor_provider_connections"
        ? Promise.resolve({
          data: null,
          error: opts.providerPrepareFails
            ? { message: "prepare exploded" }
            : null,
        })
        : chain;
    chain.then = undefined;
    return chain;
  };

  const supabase = {
    from: (name: string) => table(name),
    rpc: (name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ name, params });
      if (name === "get_effective_limits") {
        return Promise.resolve({ data: limits, error: null });
      }
      if (name === "fluenci_user_today") {
        return Promise.resolve({ data: "2026-09-06", error: null });
      }
      if (name === "fluenci_user_month") {
        return Promise.resolve({ data: "2026-09-01", error: null });
      }
      if (name === "reserve_tutor_session") {
        const status = opts.monthlyOk === false
          ? "monthly_limit"
          : opts.dailyOk === false
          ? "daily_limit"
          : "reserved";
        return Promise.resolve({ data: { status }, error: null });
      }
      if (name === "settle_tutor_session") {
        return Promise.resolve({
          data: {
            status: "settled",
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

  return { supabase, rpcCalls };
}

const request = {
  targetLanguage: "es",
  nativeLanguage: "en",
  level: "intermediate",
  correctionMode: "as_you_go" as const,
};
const env = { safetySalt: "salt", supabaseUrl: "https://project.supabase.co" };

Deno.test("a free-tier learner is walled before any money moves", async () => {
  const { supabase, rpcCalls } = makeStub({
    tier: null,
    limits: { dailyTutorMinutes: 0, monthlyTutorCents: 0, dailyChatCards: 3 },
  });
  const res = await handleStart(supabase, "user-1", request, env);
  assertEquals(res.status, 403);
  assertEquals(res.body.code, "TUTOR_NOT_ENTITLED");
  // Nothing was reserved, so nothing needs refunding.
  assert(!rpcCalls.some((c) => c.name === "reserve_tutor_session"));
});

Deno.test("daily and monthly ceilings are reserved in one database call", async () => {
  const { supabase, rpcCalls } = makeStub();
  await handleStart(supabase, "user-1", request, env);

  assertEquals(
    rpcCalls.filter((c) => c.name === "reserve_tutor_session").length,
    1,
  );
  assert(!rpcCalls.some((c) => c.name === "consume_monthly_quota"));
  assert(!rpcCalls.some((c) => c.name === "consume_daily_quota"));
});

Deno.test("the counters and RPC parameter names are exactly right", async () => {
  const { supabase, rpcCalls } = makeStub();
  await handleStart(supabase, "user-1", request, env);

  const reservation = rpcCalls.find((c) => c.name === "reserve_tutor_session");
  assertEquals(reservation?.params.p_daily_limit, 1800);
  assertEquals(reservation?.params.p_monthly_limit, 800);
  assertEquals(reservation?.params.p_user_id, "user-1");

  // These two genuinely differ in production and getting one wrong reads the
  // wrong row silently.
  const today = rpcCalls.find((c) => c.name === "fluenci_user_today");
  assert(today && "p_uid" in today.params, "fluenci_user_today takes p_uid");
  const month = rpcCalls.find((c) => c.name === "fluenci_user_month");
  assert(
    month && "p_user_id" in month.params,
    "fluenci_user_month takes p_user_id",
  );
});

Deno.test("a failed provider capability write moves no money", async () => {
  const { supabase, rpcCalls } = makeStub({ providerPrepareFails: true });
  const res = await handleStart(supabase, "user-1", request, env);
  assertEquals(res.status, 500);
  assertEquals(res.body.code, "SESSION_PREPARE_FAILED");
  assert(!rpcCalls.some((c) => c.name === "reserve_tutor_session"));
});

Deno.test("a daily refusal moves neither reservation", async () => {
  const { supabase, rpcCalls } = makeStub({ dailyOk: false });
  const res = await handleStart(supabase, "user-1", request, env);
  assertEquals(res.status, 429);
  assertEquals(res.body.code, "DAILY_TUTOR_LIMIT_REACHED");
  assertEquals(
    rpcCalls.filter((c) => c.name === "reserve_tutor_session").length,
    1,
  );
  assert(!rpcCalls.some((c) => c.name.startsWith("refund_")));
});

Deno.test("a monthly refusal takes nothing and refunds nothing", async () => {
  const { supabase, rpcCalls } = makeStub({ monthlyOk: false });
  const res = await handleStart(supabase, "user-1", request, env);
  assertEquals(res.status, 429);
  assertEquals(res.body.code, "MONTHLY_TUTOR_BUDGET_REACHED");
  assertEquals(
    rpcCalls.filter((c) => c.name === "reserve_tutor_session").length,
    1,
  );
  assert(
    !rpcCalls.some((c) => c.name.startsWith("refund_")),
    "nothing was taken, so nothing to refund",
  );
});

Deno.test("a failed session insert moves no quota", async () => {
  const { supabase, rpcCalls } = makeStub({ sessionInsertFails: true });
  const res = await handleStart(supabase, "user-1", request, env);
  assertEquals(res.status, 500);
  assert(!rpcCalls.some((c) => c.name === "reserve_tutor_session"));
  assert(!rpcCalls.some((c) => c.name === "settle_tutor_session"));
});

Deno.test("a successful start never returns the instructions or the voice", async () => {
  // CLAUDE.md section 6: model and system prompts must not be exposed. The
  // whole point of minting server-side is that the prompt stays here.
  const { supabase } = makeStub();
  const res = await handleStart(supabase, "user-1", request, env);
  assertEquals(res.status, 200);
  assert(typeof res.body.connectionToken === "string");
  assertEquals(res.body.connectionToken.length, 64);
  assertEquals(
    res.body.callsUrl,
    "https://project.supabase.co/functions/v1/tutor-session",
  );
  assert(
    !("clientSecret" in res.body),
    "provider credentials must never reach the client",
  );
  assert(
    !("instructions" in res.body),
    "instructions must never reach the client",
  );
  assert(!("voice" in res.body), "the voice id must never reach the client");
  assert(!("turn_detection" in res.body));
  const serialised = JSON.stringify(res.body);
  assert(
    !serialised.includes("CORRECTING mode"),
    "prompt text leaked into the response",
  );
});
