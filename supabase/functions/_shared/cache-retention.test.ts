/**
 * Tests for translation_cache retention (migration 068).
 *
 * The property that matters: a translation people keep using never expires,
 * and a cache hit is a plain read almost every time. Getting the second one
 * wrong would quietly reintroduce one Postgres UPDATE per translation.
 *
 * Run with: npm run test:functions
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  CACHE_REFRESH_WHEN_DAYS_LEFT,
  CACHE_TTL_DAYS,
  cacheExpiryIso,
  shouldRefreshCacheEntry,
} from './cache-retention.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 23, 12, 0, 0);

/** An entry expiring `days` from NOW. */
const expiringIn = (days: number) => new Date(NOW + days * DAY_MS).toISOString();

Deno.test('cacheExpiryIso is a full window out', () => {
  assertEquals(cacheExpiryIso(NOW), new Date(NOW + CACHE_TTL_DAYS * DAY_MS).toISOString());
});

Deno.test('a freshly written entry is not immediately refreshed', () => {
  // Otherwise every hit on a new entry would also be a write.
  assertEquals(shouldRefreshCacheEntry(cacheExpiryIso(NOW), NOW), false);
});

Deno.test('no refresh while the entry is comfortably alive', () => {
  assertEquals(shouldRefreshCacheEntry(expiringIn(CACHE_REFRESH_WHEN_DAYS_LEFT + 1), NOW), false);
  assertEquals(shouldRefreshCacheEntry(expiringIn(89), NOW), false);
});

Deno.test('refreshes once inside the last third of the window', () => {
  assertEquals(shouldRefreshCacheEntry(expiringIn(CACHE_REFRESH_WHEN_DAYS_LEFT), NOW), true);
  assertEquals(shouldRefreshCacheEntry(expiringIn(1), NOW), true);
});

Deno.test('an already-expired entry still refreshes if it is served', () => {
  // The sweep is daily, so a just-expired row can still be read. Serving it
  // and extending it beats making the learner pay for a regeneration.
  assertEquals(shouldRefreshCacheEntry(expiringIn(-1), NOW), true);
});

Deno.test('writes are bounded to at most one per row per 60 days', () => {
  // A refresh at the boundary pushes the deadline a full TTL out, so the next
  // refresh cannot happen until TTL - REFRESH_WINDOW days later. This is the
  // guarantee that a hot entry does not become an UPDATE on every hit.
  const refreshedAt = NOW;
  const newDeadline = cacheExpiryIso(refreshedAt);
  const quietDays = CACHE_TTL_DAYS - CACHE_REFRESH_WHEN_DAYS_LEFT;

  assertEquals(shouldRefreshCacheEntry(newDeadline, refreshedAt + (quietDays - 1) * DAY_MS), false);
  assertEquals(shouldRefreshCacheEntry(newDeadline, refreshedAt + quietDays * DAY_MS), true);
});

Deno.test('unusable timestamps are left for the sweep, not kept alive', () => {
  assertEquals(shouldRefreshCacheEntry(null, NOW), false);
  assertEquals(shouldRefreshCacheEntry(undefined, NOW), false);
  assertEquals(shouldRefreshCacheEntry('not-a-date', NOW), false);
  assertEquals(shouldRefreshCacheEntry('', NOW), false);
});
