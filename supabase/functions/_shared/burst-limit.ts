/**
 * Per-user burst rate limiting. Protects against rapid-fire abuse between
 * daily-quota boundaries; the daily quotas in consume_daily_quota remain the
 * hard cost backstop.
 *
 * Counted in Redis, with the original increment_rate_limit() RPC kept as a
 * fallback.
 *
 * Why the move: increment_rate_limit is a row-locked UPDATE on `api_cache`,
 * so every rate-limited call — every chat message, hint, translation, TTS
 * clip — put a write to the PRIMARY DATABASE in front of the decision to
 * allow it. That table showed a 2:1 dead-to-live tuple ratio at near-zero
 * traffic, which is the churn signature of a key-value cache living in a
 * table. A counter with a TTL is the canonical Redis workload; this is the
 * highest-traffic thing in the codebase that belongs there.
 *
 * The RPC is retained rather than deleted because losing the check entirely
 * during a cache blip would be a real regression: falling back keeps the
 * protection, just on the slower path. Order is therefore:
 *
 *   1. Redis  — normal path, one round trip, no Postgres write.
 *   2. RPC    — only when Redis is unconfigured or did not answer.
 *   3. Allow  — when neither can answer. Fails OPEN on purpose; the daily
 *               quotas still cap spend.
 *
 * Both paths are fixed-window with identical semantics, so a fallback mid
 * window changes nothing a caller can observe beyond the count restarting.
 */
import { redisRateLimit } from './redis.ts';

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = any;

/**
 * `supabase` may be null for callers that have no service-role client to
 * hand (lesson-session) — those get Redis or nothing, which is correct: a
 * function whose whole job runs through Redis gains nothing from a Postgres
 * fallback it would only reach when Redis is already down.
 */
export async function checkBurstLimit(
  supabase: AnySupabaseClient | null,
  userId: string,
  action: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  const { allowed, counted } = await redisRateLimit(
    rateLimitKey(action, userId),
    maxRequests,
    windowSeconds,
  );
  if (counted) return allowed;

  if (!supabase) return true;

  // Redis could not answer — fall back so the window is still enforced.
  const { data, error } = await supabase.rpc('increment_rate_limit', {
    p_cache_key: `burst:${action}:${userId}`,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.warn(`[burst-limit] ${action} fallback check failed:`, error.message);
    return true;
  }
  return data === true;
}

/** One key format for every rate-limited action, Redis side. */
export function rateLimitKey(action: string, userId: string): string {
  return `ratelimit:${action}:${userId}`;
}
