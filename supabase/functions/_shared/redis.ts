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

/**
 * SET key value EX ttlSeconds NX — claim a key only if nobody holds it.
 *
 * Returns whether THIS caller made the claim. Used for at-most-once handling
 * of an event that may be delivered more than once (see revenuecat-webhook).
 * The claim is a short-cut, never a correctness guarantee: it can be lost to
 * an eviction or a cold cache, so callers must still be idempotent on their
 * own. That is why it returns a boolean rather than throwing.
 */
export async function redisSetNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const ttl = Math.max(1, Math.floor(ttlSeconds));
  const result = await command(['SET', key, value, 'EX', ttl, 'NX']);
  // Upstash returns "OK" on a successful claim and null when the key exists.
  return result === 'OK';
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
 * Deliberately NOT the `api_cache`-backed increment_rate_limit() RPC. That is
 * a row-locked UPDATE on the primary database in front of every rate-limited
 * call — for AI endpoints, one Postgres write per chat message, hint and
 * translation, purely to decide whether to allow the request. `api_cache`
 * carries a 2:1 dead-to-live tuple ratio at near-zero traffic, which is what
 * a key-value cache looks like wearing a table costume. Counting here keeps
 * the check off Postgres entirely.
 *
 * INCR-then-EXPIRE is done as ONE Lua script rather than two commands. Two
 * commands have a real failure mode: if the EXPIRE is lost, the counter keeps
 * a key with no TTL, climbs past the cap, and locks that user out
 * permanently. The script makes the pair atomic and halves the round trips.
 *
 * Fails OPEN — a rate limiter that takes the product down when the cache
 * blips is worse than the abuse it prevents. Callers that can reach Postgres
 * should prefer _shared/burst-limit.ts, which falls back rather than
 * giving up the check entirely.
 */
const RATE_LIMIT_SCRIPT =
  'local c = redis.call("INCR", KEYS[1]) ' +
  'if c == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end ' +
  'return c';

export interface RateLimitOutcome {
  allowed: boolean;
  /** false when Redis could not answer, so a caller can fall back. */
  counted: boolean;
}

export async function redisRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitOutcome> {
  if (!isRedisConfigured()) return { allowed: true, counted: false };
  try {
    const count = await command([
      'EVAL',
      RATE_LIMIT_SCRIPT,
      1,
      key,
      Math.max(1, Math.floor(windowSeconds)),
    ]);
    if (typeof count !== 'number') return { allowed: true, counted: false };
    return { allowed: count <= maxRequests, counted: true };
  } catch (err) {
    console.warn('[redis] rate-limit check failed:', err);
    return { allowed: true, counted: false };
  }
}
