import type { ProficiencyLevel } from '../types';

// ─── Feature flags ───────────────────────────────────────────────────────
// School/teacher features are built but deferred for public launch.
// Flip to true when ready to enable for schools.
export const SCHOOL_ENABLED = false;

// Live voice tutor — the speech-to-speech call.
//
// OFF for the first TestFlight. This is the CLIENT-side kill switch and it
// controls exactly one thing: whether the tutor entry point exists in the UI.
// It does not and cannot stop spend — a build already in someone's hands has
// its own copy of this constant. The server-side switch is the one that binds:
// `get_effective_limits` returning `dailyTutorMinutes: 0`, which makes `start`
// answer TUTOR_NOT_ENTITLED for everyone regardless of what any binary thinks.
// Turn both off if the feature misbehaves; turn this one off first, because it
// is the one that ships without a deploy.
//
// Unverified on hardware at the time this was written: WebRTC over cellular
// and behind carrier NAT, audio routing to and from Bluetooth, what an
// incoming phone call does to a live session, and whether the ephemeral
// credential survives a backgrounded app long enough to matter. Any of those
// misbehaving is a reason to set this back to false — the entry point is the
// only thing that disappears, and an in-flight call is unaffected.
export const TUTOR_ENABLED = false;

export const TUTOR_DEFAULTS = {
  /** What the client ASKS for. The server grants the smaller of this, what is
   *  left of the day, and what is left of the month — see `resolveGrant` in
   *  supabase/functions/_shared/tutor-pricing.ts. Asking for less than the
   *  daily allowance on purpose: a learner who wants a second call today
   *  should still have the minutes for one. */
  requestedMinutes: 10,
  /** Fallback heartbeat cadence, in seconds. The server sends the real value
   *  as `heartbeatIntervalSeconds` on `start`; this is only what to use before
   *  that response has arrived, and it must stay well under the reaper's
   *  abandonment window. */
  heartbeatSeconds: 20,
  /** Longest a single call may run regardless of budget. A ceiling on the
   *  worst case where every other bound has failed. */
  maxSessionMs: 60 * 60 * 1000,
} as const;

export const SRS_DEFAULTS = {
  initialEaseFactor: 2.5,
  minimumEaseFactor: 1.3,
  /**
   * Fallback only. The enforced cap is per-tier (`PLANS[*].dailyNewCards`) and
   * is derived SERVER-side inside `try_consume_new_card_slot` — the client
   * cannot assert it. This value is what the UI shows before the real
   * allowance has loaded.
   */
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

// ─── Legal destinations ──────────────────────────────────────────────────
// App Review requires functional Terms and Privacy links inside the binary
// (Guideline 3.1.2 for any subscription surface). These are the same URLs the
// profile screens already open; new code should import them from here rather
// than hardcoding a sixth copy.
//
// fluenciapp.com was registered on 2026-09-07 (fluenci.com is someone else's
// parking page). As of that date nothing is hosted there yet: these paths must
// serve real terms and privacy documents before App Store submission, because
// review follows them.
export const TERMS_URL = 'https://fluenciapp.com/terms';
export const PRIVACY_URL = 'https://fluenciapp.com/privacy';

// ─── App Store listing ───────────────────────────────────────────────────
// Where an invite link sends a friend. App ID from App Store Connect.
export const APP_STORE_URL = 'https://apps.apple.com/app/id6761507250';
