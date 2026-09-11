/**
 * Central plan definitions — single source of truth for pricing, limits, and features.
 * Used by: subscription UI, stripe checkout, and mirrored in Edge Functions for enforcement.
 *
 * IMPORTANT: If you change limits here, also update the PLAN_LIMITS objects in:
 *   - supabase/functions/ai-chat/index.ts
 *   - supabase/functions/score-pronunciation/index.ts
 */

export type PlanId = 'starter' | 'basic' | 'premium' | 'vip';

/**
 * `dailyNewCards` value that means "no ceiling".
 *
 * A sentinel rather than `null` or `-1` because `get_effective_limits` merges a
 * classroom's contract against the personal plan with `GREATEST()`, and both of
 * those would lose that comparison against any real number — a school student
 * on an unlimited personal plan would silently inherit the school's smaller
 * cap. A large int is the only representation that survives the merge.
 *
 * 9999 is unreachable in practice: the curriculum is finite and nobody
 * introduces four figures of new vocabulary in a day.
 */
export const UNLIMITED_NEW_CARDS = 9999;

export function isUnlimitedNewCards(cap: number): boolean {
  return cap >= UNLIMITED_NEW_CARDS;
}

/**
 * `dailyHints` value that means "no ceiling" (vip). Deliberately the same
 * sentinel and the same magnitude as `UNLIMITED_NEW_CARDS`, for the same
 * reason: `get_effective_limits` merges the school contract with `GREATEST()`,
 * which `null` or `-1` would lose.
 */
export const UNLIMITED_HINTS = UNLIMITED_NEW_CARDS;

export function isUnlimitedHints(cap: number): boolean {
  return cap >= UNLIMITED_HINTS;
}

/** `dailyWordLookups` value that means "no ceiling" (vip). Same sentinel and
 *  same reason as the two above. */
export const UNLIMITED_WORD_LOOKUPS = UNLIMITED_NEW_CARDS;

export function isUnlimitedWordLookups(cap: number): boolean {
  return cap >= UNLIMITED_WORD_LOOKUPS;
}

export interface SchoolContractConfig {
  dailyVoiceMinutes: number;
  dailyTextMessages: number;
  dailyWritingGrades: number;
  dailyPronunciationScores: number;
  // No `dailyLessonTtsPlays` here on purpose: `get_effective_limits` predates
  // that counter and does not return it, so a school contract cannot override
  // it. Students fall through to their plan's value, which is generous enough
  // that a contract override has never been needed.
  dailyNewCards: number;
  dailyHints: number;
  // No `dailyTranslations` / `dailyWordLookups` here for the same reason as
  // `dailyLessonTtsPlays` above — get_effective_limits does merge them, but no
  // contract_config has ever carried either key, so the COALESCE in migrations
  // 093/094 resolves them to 0 and the personal plan's value wins.
  audiobookNarration: boolean;
  offlineMode?: boolean;
  allowed_email_domains?: string[];
}

export interface PlanDefinition {
  name: string;
  priceMonthlyUsd: number;
  dailyTextMessages: number;
  dailyVoiceMinutes: number;
  dailyWritingGrades: number;
  dailyPronunciationScores: number;
  /**
   * Lesson-exercise TTS syntheses per day. Metered separately from
   * `dailyVoiceMinutes` so the free tier can hear its listening exercises
   * without being handed chat or voice-practice minutes.
   */
  dailyLessonTtsPlays: number;
  dailyNewCards: number;
  /**
   * Hints per day from the get-hint button, metered on
   * `daily_usage.hints_generated` (migration 090).
   *
   * Free users keep a real allowance rather than none: their hints are generic
   * and come back from `hint_cache`, so they cost almost nothing, and someone
   * stuck mid-exercise is the worst person to turn away. Paid tiers get a
   * hint shaped by their own recent mistakes, which cannot be cached per-card
   * and so is a live call every time.
   */
  dailyHints: number;
  /** Chat Translate-button translations per day (migration 093), charged on
   *  cache miss only. */
  dailyTranslations: number;
  /**
   * Single-word lookups in the reader per day (migration 094), charged on
   * cache miss only.
   *
   * Far larger than `dailyTranslations` because one lookup is one word rather
   * than up to 1500 characters, and because reading a book is the main thing a
   * free account can do at length. A word the corpus has already been asked
   * about comes back from a cache shared by every learner and costs nothing.
   */
  dailyWordLookups: number;
  /**
   * Review cards per day created from vocabulary a conversation introduced.
   *
   * Separate from `dailyNewCards` deliberately — see the note on the edge-side
   * mirror in supabase/functions/_shared/plan-limits.ts. These cards arrive
   * without the learner asking for them, so the cap limits how much
   * unrequested review one chatty session can add to tomorrow.
   */
  dailyChatCards: number;
  /**
   * Minutes of LIVE VOICE TUTOR per day — the speech-to-speech tab, not the
   * chat's voice mode. Mirrors `dailyTutorMinutes` in
   * supabase/functions/_shared/plan-limits.ts and the `get_effective_limits`
   * DB function; all three must agree.
   *
   * DISPLAY WARNING: this is NOT the number to put on the pricing page. It is
   * the weaker of the two ceilings — it stops one bad day. The monthly spend
   * ceiling is what actually bounds the feature, and it bites first: a basic
   * learner using 15 minutes a day runs out of MONTH on day two. Show
   * `tutorMinutesPerMonth(plan)` instead.
   */
  dailyTutorMinutes: number;
  /**
   * Per-user monthly spend ceiling for the live tutor, in cents.
   *
   * Denominated in cents internally and MINUTES externally — never render a
   * dollar figure for a learner's remaining AI time. Use
   * `tutorMinutesPerMonth()` below for anything user-facing.
   */
  monthlyTutorCents: number;
  audiobookNarration: boolean;
  offlineMode: boolean;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  // `starter` is the FREE plan — a real, supported tier, not the absence of
  // one. Every signed-in user resolves to it via `subscription?.tier ??
  // 'starter'` until they buy, and they stay usable there indefinitely.
  //
  // The rule that decides what it contains: a free account may use anything
  // that costs us nothing per learner, and nothing that doesn't. So lessons,
  // reviews, reading, gamification and the daily news (generated once per
  // language per day by a cron, whether one learner reads it or a million)
  // are all in. Every per-call AI quota is 0:
  //
  //   dailyTextMessages ......... the AI tutor, per message
  //   dailyVoiceMinutes ......... live voice practice, per minute
  //   dailyWritingGrades ........ a model call per submission
  //   dailyPronunciationScores .. a Whisper call per attempt
  //
  // `dailyLessonTtsPlays` is the single deliberate exception. Listening and
  // dictation exercises are voiced by the `tts` function, so a hard 0 would
  // not make the free tier smaller — it would make its lessons visibly
  // broken. The counter is separate from voice minutes precisely so that
  // allowance cannot leak into chat, and the TTS cache is content-addressed,
  // so a fixed curriculum converges to near-zero marginal cost.
  //
  // These numbers are the CLIENT's copy. The enforcing copy lives in
  // supabase/functions/_shared/plan-limits.ts — a client that believes a quota
  // is 0 while the server grants it is the migration-057 class of bug, so the
  // two files must move together.
  //
  // Classroom students are the deliberate exception to the zeros — they never
  // buy a personal subscription, and `get_effective_limits` merges their org's
  // contract_config with GREATEST(), so a 0 personal quota still yields the
  // school's allowance.
  starter: {
    name: 'Free',
    priceMonthlyUsd: 0,
    dailyTextMessages: 0,
    dailyVoiceMinutes: 0,
    dailyWritingGrades: 0,
    dailyPronunciationScores: 0,
    dailyLessonTtsPlays: 5,
    dailyNewCards: 5,
    dailyHints: 5,
    dailyTranslations: 10,
    dailyWordLookups: 60,
    dailyChatCards: 3,
    dailyTutorMinutes: 0,
    monthlyTutorCents: 0,
    audiobookNarration: false,
    offlineMode: false,
  },
  basic: {
    name: 'Basic',
    priceMonthlyUsd: 9.99,
    // 20, not 25: migration 106 cut basic chat on 2026-09-02 and this mirror
    // was never updated. The server is the authority, so the old 25 here only
    // ever meant the upgrade prompt fired five messages after the API began
    // refusing.
    dailyTextMessages: 20,
    dailyVoiceMinutes: 6,
    dailyWritingGrades: 3,
    dailyPronunciationScores: 3,
    dailyLessonTtsPlays: 25,
    dailyNewCards: 20,
    dailyHints: 30,
    dailyTranslations: 30,
    dailyWordLookups: 300,
    dailyChatCards: 15,
    dailyTutorMinutes: 15,
    monthlyTutorCents: 300,
    audiobookNarration: false,
    offlineMode: false,
  },
  premium: {
    name: 'Premium',
    priceMonthlyUsd: 19.99,
    dailyTextMessages: 50,
    dailyVoiceMinutes: 12,
    dailyWritingGrades: 7,
    dailyPronunciationScores: 5,
    dailyLessonTtsPlays: 50,
    dailyNewCards: UNLIMITED_NEW_CARDS,
    dailyHints: 75,
    dailyTranslations: 60,
    dailyWordLookups: 600,
    dailyChatCards: 30,
    dailyTutorMinutes: 30,
    monthlyTutorCents: 800,
    audiobookNarration: true,
    offlineMode: true,
  },
  vip: {
    name: 'VIP',
    priceMonthlyUsd: 29.99,
    dailyTextMessages: 75,
    dailyVoiceMinutes: 18,
    dailyWritingGrades: 12,
    dailyPronunciationScores: 7,
    dailyLessonTtsPlays: 80,
    dailyNewCards: UNLIMITED_NEW_CARDS,
    dailyHints: UNLIMITED_HINTS,
    dailyTranslations: 90,
    dailyWordLookups: UNLIMITED_WORD_LOOKUPS,
    dailyChatCards: 50,
    dailyTutorMinutes: 45,
    monthlyTutorCents: 1400,
    audiobookNarration: true,
    offlineMode: true,
  },
};

/** Feature bullet points for the subscription/pricing UI. */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  // Free usage is metered by `dailyNewCards`, not by a per-mistake currency.
  // That is the line worth selling: being wrong is always free, and every
  // review of material already learned is unlimited on every tier.
  //
  // `starter` lists what a free account actually gets, so declining the
  // paywall is an informed choice rather than a leap. Everything here is
  // something the app can serve at no marginal cost per learner; the AI tutor,
  // voice practice and writing grades are the things that aren't, and they are
  // the reason the paid rungs exist.
  starter: [
    '5 new words a day',
    'Unlimited review — always',
    'All lessons, reading and daily news',
    'One photo avatar, free',
  ],
  // Every number below is pinned against PLANS by lib/plans-features.test.ts.
  // The strings drifted once (basic advertised 25 messages and 10 voice
  // minutes against real caps of 20 and 6); the test is what stops a second
  // drift. Use the plan's own name in the string, never a bare adjective.
  basic: [
    '20 new words a day',
    'Unlimited review — always',
    'Sol remembers your moment',
    '20 tutor messages per day',
    '6 minutes of voice practice per day',
    '3 writing grades per day',
  ],
  premium: [
    'Everything in Basic',
    'Unlimited new words',
    '50 tutor messages per day',
    '12 minutes of voice practice per day',
    '7 writing grades per day',
    'Lessons and books offline',
  ],
  vip: [
    'Everything in Premium',
    '75 tutor messages per day',
    '18 minutes of voice practice per day',
    '12 writing grades per day',
    'Unlimited hints',
    'Audiobook narration',
  ],
};

/**
 * Return numeric limits for a given plan, suitable for backend enforcement.
 */
export function getPlanLimits(planId: PlanId | string): {
  dailyTextMessages: number;
  dailyVoiceMinutes: number;
  dailyWritingGrades: number;
  dailyPronunciationScores: number;
  dailyLessonTtsPlays: number;
  dailyHints: number;
  dailyTranslations: number;
  dailyWordLookups: number;
  dailyChatCards: number;
  dailyTutorMinutes: number;
  monthlyTutorCents: number;
} {
  const plan = PLANS[planId as PlanId] ?? PLANS.starter;
  return {
    dailyTextMessages: plan.dailyTextMessages,
    dailyVoiceMinutes: plan.dailyVoiceMinutes,
    dailyWritingGrades: plan.dailyWritingGrades,
    dailyPronunciationScores: plan.dailyPronunciationScores,
    dailyLessonTtsPlays: plan.dailyLessonTtsPlays,
    dailyHints: plan.dailyHints,
    dailyTranslations: plan.dailyTranslations,
    dailyWordLookups: plan.dailyWordLookups,
    dailyChatCards: plan.dailyChatCards,
    dailyTutorMinutes: plan.dailyTutorMinutes,
    monthlyTutorCents: plan.monthlyTutorCents,
  };
}

/**
 * The live-tutor number a learner should actually be shown.
 *
 * The daily cap reads like the headline figure and is not: at 12 cents a
 * minute the monthly ceiling binds long before it does, so quoting "15 minutes
 * a day" would promise 450 minutes and deliver 24. Keep this the only place
 * the two ceilings get turned into a user-facing quantity.
 *
 * Kept in sync by hand with TUTOR_CENTS_PER_MINUTE in
 * supabase/functions/_shared/tutor-pricing.ts. That constant is expected to
 * fall once real invoices are reconciled, which will RAISE these minutes at
 * identical margin — so re-check it here when it moves.
 */
export const TUTOR_CENTS_PER_MINUTE = 12;
export const TUTOR_SESSION_FIXED_CENTS = 1;

export function tutorMinutesPerMonth(planId: PlanId | string): number {
  const plan = PLANS[planId as PlanId] ?? PLANS.starter;
  const spendable = plan.monthlyTutorCents - TUTOR_SESSION_FIXED_CENTS;
  if (spendable <= 0) return 0;
  return Math.floor(spendable / TUTOR_CENTS_PER_MINUTE);
}

/** Stripe price keys used in checkout and webhook handling. */
export const STRIPE_PRICE_KEYS = {
  basic_monthly: 'basic_monthly',
  basic_yearly: 'basic_yearly',
  premium_monthly: 'premium_monthly',
  premium_yearly: 'premium_yearly',
  vip_monthly: 'vip_monthly',
  vip_yearly: 'vip_yearly',
} as const;
