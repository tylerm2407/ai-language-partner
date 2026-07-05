/**
 * Device-local calendar-day helpers.
 *
 * Day keys for daily_stats / daily_challenges / streak logic must be the
 * DEVICE-local date, not UTC — `new Date().toISOString().split('T')[0]`
 * records a 9 PM New York practice against tomorrow. The server mirrors
 * this with public.fluenci_user_today() (migration 044), which resolves
 * "today" from user_profiles.timezone; useTimezoneSync (hooks/useProfile.ts)
 * keeps that column tracking the device.
 */

/** Format a Date as YYYY-MM-DD using the device's local calendar day. */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's device-local day key (YYYY-MM-DD). `now` is injectable for tests. */
export function localToday(now: Date = new Date()): string {
  return localDayKey(now);
}
