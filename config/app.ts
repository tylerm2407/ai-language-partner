import type { ProficiencyLevel } from '../types';

// ─── Feature flags ───────────────────────────────────────────────────────
// School/teacher features are built but deferred for public launch.
// Flip to true when ready to enable for schools.
export const SCHOOL_ENABLED = false;

// Hands-free (eyes-free commute) mode.
//
// ON at Tyler's call. Worth knowing what that does and does not expose: the
// audio-session refactor and the review-queue fixes are NOT gated by this flag
// and were already live regardless. The flag controls one thing — whether the
// Practice tab offers the hands-free entry point.
//
// Still unverified on hardware at the time this was switched on: audio routing,
// background playback with the screen locked, incoming-call handling, the
// endpointer in real road noise, and Bluetooth car audio. Turn it back off if
// any of those misbehave — the entry point is the only thing that disappears.
export const HANDSFREE_ENABLED = true;

export const HANDSFREE_DEFAULTS = {
  targetDurationMs: 20 * 60 * 1000,
  durationOptionsMs: [5, 10, 20, 30].map((m) => m * 60 * 1000),
  /** Clips kept ready ahead of the current card. */
  prefetchAhead: 3,
  /** Clips fetched before the session is allowed to start — tunnel insurance. */
  prewarmCount: 5,
  maxAttemptsPerCard: 2,
  resumeGraceMs: 120_000,
  /** Ceiling on queue size regardless of duration, so a long session cannot
   *  pull an unbounded number of rows over a cellular link at startup. */
  maxQueueItems: 60,
} as const;

export const SRS_DEFAULTS = {
  initialEaseFactor: 2.5,
  minimumEaseFactor: 1.3,
  newCardsPerDay: 20,
} as const;

export const DAILY_GOALS = [5, 10, 15, 20, 30] as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'es' as const, name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr' as const, name: 'French', flag: '🇫🇷' },
  { code: 'de' as const, name: 'German', flag: '🇩🇪' },
  { code: 'it' as const, name: 'Italian', flag: '🇮🇹' },
  { code: 'pt' as const, name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ja' as const, name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko' as const, name: 'Korean', flag: '🇰🇷' },
  { code: 'zh' as const, name: 'Chinese', flag: '🇨🇳' },
  { code: 'ru' as const, name: 'Russian', flag: '🇷🇺' },
] as const;

// ─── Daily News tiers ────────────────────────────────────────────────────
// Articles are generated in two difficulty tiers per language per day.
// `easy` covers CEFR A1–B1 (beginner → intermediate); `hard` covers
// B2–C1 (upper-intermediate → advanced). Keeping two tiers instead of
// per-CEFR gives a 110× Claude-token reduction vs. per-user generation
// while still keeping content roughly level-appropriate.
export type NewsTier = 'easy' | 'hard';

export function levelToNewsTier(level: ProficiencyLevel): NewsTier {
  return level === 'upper_intermediate' || level === 'advanced' ? 'hard' : 'easy';
}
