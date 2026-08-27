/**
 * Device-local calendar-day helpers.
 *
 * Day keys for daily_stats / daily_challenges must be the
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

/** Midnight at the start of a Date's local calendar day. */
function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * A past timestamp as a calendar-relative label: "Today", "Yesterday",
 * "3 days ago", then an absolute date once that stops being useful.
 *
 * CALENDAR days, not elapsed milliseconds. `Math.floor(diffMs / 86_400_000)`
 * called a lesson finished at 3 PM Monday "Yesterday" right up until 3 PM
 * Wednesday, because 1.9 elapsed days floors to 1 — the label lagged the
 * calendar by up to a day and never agreed with what the learner remembered.
 * Both ends are reduced to local midnight first, so the answer changes when
 * the date does. Rounding the day difference absorbs the 23h/25h DST days,
 * which would otherwise round a clean 1.0 down to 0.
 *
 * `now` is injectable for tests.
 */
export function formatRelativeDay(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Unknown date';

  const days = Math.round(
    (startOfLocalDay(now).getTime() - startOfLocalDay(then).getTime()) / 86_400_000,
  );

  // A timestamp in the future is device clock skew, not a real event. "Today"
  // is the honest floor; "in 2 days" would be nonsense on a completion.
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  // Past a week "34 days ago" is arithmetic the reader has to undo. The year
  // shows only when it is not the current one — "Apr 23" is unambiguous this
  // year and quietly wrong three years from now.
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (then.getFullYear() !== now.getFullYear()) options.year = 'numeric';
  return then.toLocaleDateString(undefined, options);
}
