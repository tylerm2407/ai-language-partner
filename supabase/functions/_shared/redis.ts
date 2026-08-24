/**
 * Redis (Upstash REST) client for Edge Functions.
 *
 * Used for state that is deliberately ephemeral and must expire on its own —
 * currently mid-lesson resume snapshots, which live for one day and then let
 * the lesson restart. Anything that must survive (lesson completions, XP,
 * SRS) belongs in Postgres, never here.
 *
 * Upstash's REST API is used rather than a TCP client because Edge Functions
 * are short-lived isolates: a pooled TCP connection would be re-established
 * per invocation anyway, and the REST call carries its own auth.
 *
 * Configuration (Supabase Edge Function secrets):
 *   UPSTASH_REDIS_REST_URL    https://<db>.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN  <token>
 *
 * When either is missing `isRedisConfigured()` is false and every helper
 * throws RedisUnavailableError. Callers are expected to degrade rather than
 * fail: a missing Redis must never stop someone from doing a lesson.
 */

const REDIS_URL = Deno.env.get('UPSTASH_REDIS_REST_URL');
const REDIS_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

/** Requests are capped well under the Edge Function budget — a slow cache
 *  must not hold a lesson-resume call open. */
const REDIS_TIMEOUT_MS = 3000;

export class RedisUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisUnavailableError';
  }
}

export function isRedisConfigured(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

/**
 * Issue one Redis command over the REST API.
 * `["SET", key, value, "EX", "86400"]` → `{ result: "OK" }`.
 */
async function command(args: (string | number)[]): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new RedisUnavailableError('Redis is not configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REDIS_TIMEOUT_MS);
  try {
    const response = await fetch(REDIS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args.map(String)),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new RedisUnavailableError(
        `Redis command failed (${response.status}): ${detail.slice(0, 200)}`,
      );
    }

    const body = (await response.json()) as { result?: unknown; error?: string };
    if (body.error) throw new RedisUnavailableError(`Redis error: ${body.error}`);
    return body.result ?? null;
  } catch (err) {
    if (err instanceof RedisUnavailableError) throw err;
    const reason = err instanceof Error ? err.message : String(err);
    throw new RedisUnavailableError(`Redis request failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

/** GET key → the stored string, or null when absent/expired. */
export async function redisGet(key: string): Promise<string | null> {
  const result = await command(['GET', key]);
  return typeof result === 'string' ? result : null;
}

/**
 * SET key value EX ttlSeconds.
 *
 * `ttlSeconds` is always absolute-derived by the caller (deadline − now), not
 * a rolling window: a resume snapshot must expire a fixed time after the
 * lesson STARTED, so saving another answer cannot extend its life.
 */
export async function redisSetEx(key: string, value: string, ttlSeconds: number): Promise<void> {
  const ttl = Math.max(1, Math.floor(ttlSeconds));
  await command(['SET', key, value, 'EX', ttl]);
}

/** DEL key. Deleting an absent key is a no-op, not an error. */
export async function redisDel(key: string): Promise<void> {
  await command(['DEL', key]);
}

/** Remaining TTL in seconds; -2 = no such key, -1 = key without expiry. */
export async function redisTtl(key: string): Promise<number> {
  const result = await command(['TTL', key]);
  return typeof result === 'number' ? result : -2;
}

/**
 * Fixed-window rate limit, counted in Redis.
 *
 * Deliberately NOT _shared/burst-limit.ts. That helper is backed by the
 * `api_cache` TABLE via the increment_rate_limit() RPC — a row-locked
 * Postgres UPDATE. For a function called once per *answered exercise*, that
 * would put a write to the primary database in front of every keystroke's
 * worth of progress, and the thing being protected here is the Redis budget
 * anyway. Counting in the same store keeps the hot path to one round trip
 * and adds no churn to Postgres.
 *
 * INCR creates the key at 1, so EXPIRE is set only on the first request of a
 * window; the window then rolls off on its own. Fails OPEN — a rate limiter
 * that takes the feature down with it when the cache blips is worse than the
 * abuse it prevents, and the caller's own Redis calls will fail anyway.
 */
export async function redisRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const count = await command(['INCR', key]);
    if (typeof count !== 'number') return true;
    if (count === 1) {
      await command(['EXPIRE', key, Math.max(1, Math.floor(windowSeconds))]);
    }
    return count <= maxRequests;
  } catch (err) {
    console.warn('[redis] rate-limit check failed; allowing:', err);
    return true;
  }
}
