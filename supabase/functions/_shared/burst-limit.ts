/**
 * Per-user burst rate limiting via the atomic increment_rate_limit() SQL
 * function (fixed window, row-locked, backed by api_cache).
 *
 * This protects against rapid-fire abuse between daily-quota boundaries.
 * Fails OPEN on infrastructure errors — the daily quotas in
 * consume_daily_quota remain the hard cost backstop.
 */
// deno-lint-ignore no-explicit-any
type AnySupabaseClient = any;

export async function checkBurstLimit(
  supabase: AnySupabaseClient,
  userId: string,
  action: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc('increment_rate_limit', {
    p_cache_key: `burst:${action}:${userId}`,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.warn(`[burst-limit] ${action} check failed:`, error.message);
    return true;
  }
  return data === true;
}
