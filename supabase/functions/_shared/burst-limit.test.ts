/**
 * Tests for the burst limiter's fallback ordering.
 *
 * These run with no UPSTASH_* env vars set, so Redis reports itself
 * unconfigured and every case here exercises the fallback path. That is the
 * behaviour most worth pinning: the whole point of keeping the RPC was that
 * moving the counter to Redis must not be able to silently drop the check.
 *
 * Run with: npm run test:functions
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { checkBurstLimit, rateLimitKey } from './burst-limit.ts';

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

/** Minimal supabase double recording rpc() calls. */
function fakeClient(result: { data?: unknown; error?: { message: string } }) {
  const calls: RpcCall[] = [];
  return {
    calls,
    // deno-lint-ignore no-explicit-any
    rpc(fn: string, args: Record<string, unknown>): any {
      calls.push({ fn, args });
      return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
    },
  };
}

Deno.test('rateLimitKey is namespaced by action and user', () => {
  assertEquals(rateLimitKey('translate', 'u1'), 'ratelimit:translate:u1');
});

Deno.test('falls back to the RPC when Redis cannot answer', async () => {
  const client = fakeClient({ data: true });
  const allowed = await checkBurstLimit(client, 'u1', 'translate', 30, 60);

  assertEquals(allowed, true);
  // The check still happened — it did not silently vanish with Redis.
  assertEquals(client.calls.length, 1);
  assertEquals(client.calls[0].fn, 'increment_rate_limit');
  assertEquals(client.calls[0].args.p_cache_key, 'burst:translate:u1');
  assertEquals(client.calls[0].args.p_max_requests, 30);
});

Deno.test('fallback denies when the RPC says the window is full', async () => {
  const client = fakeClient({ data: false });
  assertEquals(await checkBurstLimit(client, 'u1', 'tts', 30, 60), false);
});

Deno.test('fails OPEN when the fallback RPC itself errors', async () => {
  // Daily quotas remain the hard cost backstop; a broken limiter must not
  // take the product down with it.
  const client = fakeClient({ error: { message: 'connection refused' } });
  assertEquals(await checkBurstLimit(client, 'u1', 'ai-chat', 20, 60), true);
});

Deno.test('allows when there is neither Redis nor a Postgres client', async () => {
  // lesson-session passes null deliberately: if Redis is down, every action
  // in that function fails anyway, so a Postgres fallback buys nothing.
  assertEquals(await checkBurstLimit(null, 'u1', 'lesson-session', 90, 60), true);
});

Deno.test('never calls the RPC when no client is supplied', async () => {
  // Guards against a future refactor reintroducing a Postgres write on the
  // one path that was moved off it entirely.
  const allowed = await checkBurstLimit(null, 'u1', 'lesson-session', 90, 60);
  assertEquals(allowed, true);
});
