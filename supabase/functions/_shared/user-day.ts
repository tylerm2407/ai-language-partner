/**
 * Resolve the user's local "today" for daily-quota day-keying.
 *
 * Migration 044 rolls quota days over at the USER's local midnight:
 * consume_daily_quota and increment_daily_usage resolve the day internally
 * via the SQL helper `public.fluenci_user_today(p_uid uuid) returns date`.
 * Edge-function READS of daily_usage must use the same day key, or non-UTC
 * users get their usage read from the wrong row.
 *
 * Fetch this ONCE per request and reuse it for every quota-related
 * daily_usage read/write in the handler.
 */

/** Returns YYYY-MM-DD in the user's local timezone. Degrades to UTC on any
 *  error — a wrong-day read is better than failing the request. */
// deno-lint-ignore no-explicit-any
export async function getUserToday(supabase: any, userId: string): Promise<string> {
  const utcToday = () => new Date().toISOString().split('T')[0];
  try {
    const { data, error } = await supabase.rpc('fluenci_user_today', { p_uid: userId });
    if (error || !data) {
      console.error(
        '[user-day] fluenci_user_today failed, falling back to UTC:',
        error?.message ?? 'no data returned',
      );
      return utcToday();
    }
    // Postgres `date` comes back as a 'YYYY-MM-DD' string.
    return String(data);
  } catch (err) {
    console.error(
      '[user-day] fluenci_user_today threw, falling back to UTC:',
      err instanceof Error ? err.message : String(err),
    );
    return utcToday();
  }
}
