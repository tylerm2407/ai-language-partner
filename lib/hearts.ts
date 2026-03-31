/**
 * Hearts system — regen logic computed on read (no cron).
 * Free users get 5 hearts, lose 1 per wrong answer, regen 1 every 4 hours.
 * Paid users have unlimited hearts.
 */

const REGEN_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface HeartsState {
  current: number;
  max: number;
  nextRegenAt: Date | null;
}

/**
 * Compute current hearts based on stored hearts value, max, and last loss time.
 * Hearts regenerate 1 per 4 hours since last loss, capped at max.
 */
export function computeHearts(
  hearts: number,
  max: number,
  lastLostAt: string | null
): HeartsState {
  if (hearts >= max) {
    return { current: max, max, nextRegenAt: null };
  }

  if (!lastLostAt) {
    return { current: hearts, max, nextRegenAt: null };
  }

  const lostTime = new Date(lastLostAt).getTime();
  const elapsed = Date.now() - lostTime;
  const regenCount = Math.floor(elapsed / REGEN_INTERVAL_MS);
  const current = Math.min(hearts + regenCount, max);

  if (current >= max) {
    return { current: max, max, nextRegenAt: null };
  }

  // Time until next heart: find the remainder and subtract from interval
  const timeSinceLastRegen = elapsed - regenCount * REGEN_INTERVAL_MS;
  const msUntilNext = REGEN_INTERVAL_MS - timeSinceLastRegen;
  const nextRegenAt = new Date(Date.now() + msUntilNext);

  return { current, max, nextRegenAt };
}

/**
 * Format time until next heart regen as "Xh Ym"
 */
export function formatRegenTime(nextRegenAt: Date | null): string {
  if (!nextRegenAt) return '';
  const ms = nextRegenAt.getTime() - Date.now();
  if (ms <= 0) return 'now';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
