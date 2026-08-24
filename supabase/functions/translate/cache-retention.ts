/**
 * Retention policy for translation_cache (migration 068).
 *
 * Split out of index.ts so it can be tested without standing up serve() —
 * same reason translate-core.ts exists.
 *
 * A cached translation is valid forever: the same text in the same language
 * pair never changes. The only reason anything expires is that the cache key
 * is a sha256 of USER CHAT TEXT, so the table would otherwise grow without
 * bound, one row per distinct message anyone ever translated.
 *
 * So the window is measured from LAST USE rather than creation. Anything
 * people keep re-translating survives indefinitely and never has to be
 * regenerated at Anthropic's expense; genuinely one-off messages age out.
 */

export const CACHE_TTL_DAYS = 90;

/**
 * Only refresh inside the last third of the window.
 *
 * Pushing expires_at forward on EVERY hit would turn a pure read into one
 * UPDATE per translation — precisely the row churn that made the rate limiter
 * worth moving off Postgres in the first place. Refreshing only near expiry
 * bounds it to at most one write per row per (TTL − refresh window) = 60 days,
 * while still meaning a translation in daily use never expires.
 */
export const CACHE_REFRESH_WHEN_DAYS_LEFT = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deadline for a freshly written or refreshed entry. */
export function cacheExpiryIso(now: number = Date.now()): string {
  return new Date(now + CACHE_TTL_DAYS * DAY_MS).toISOString();
}

/**
 * Is this entry close enough to expiring to be worth extending?
 *
 * False for a missing or unparseable timestamp: a row we cannot reason about
 * is left for the sweep rather than being kept alive forever by accident.
 */
export function shouldRefreshCacheEntry(
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const deadline = new Date(expiresAt).getTime();
  if (Number.isNaN(deadline)) return false;
  return deadline - now <= CACHE_REFRESH_WHEN_DAYS_LEFT * DAY_MS;
}
