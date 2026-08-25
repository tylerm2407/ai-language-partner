/**
 * Central plan definitions — single source of truth for pricing, limits, and features.
 * Used by: subscription UI, stripe checkout, and mirrored in Edge Functions for enforcement.
 *
 * IMPORTANT: If you change limits here, also update the PLAN_LIMITS objects in:
 *   - supabase/functions/ai-chat/index.ts
 *   - supabase/functions/score-pronunciation/index.ts
 */

export type PlanId = 'starter' | 'basic' | 'premium' | 'vip';

export interface SchoolContractConfig {
  dailyVoiceMinutes: number;
  dailyTextMessages: number;
  dailyWritingGrades: number;
  dailyPronunciationScores: number;
  // No `dailyLessonTtsPlays` here on purpose: `get_effective_limits` predates
  // that counter and does not return it, so a school contract cannot override
  // it. Students fall through to their plan's value, which is generous enough
  // that a contract override has never been needed.
  unlimitedHearts: boolean;
  streakShield: boolean;
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
  unlimitedHearts: boolean;
  streakShield: boolean;
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
    unlimitedHearts: false,
    streakShield: false,
    audiobookNarration: false,
    offlineMode: false,
  },
  basic: {
    name: 'Basic',
    priceMonthlyUsd: 9.99,
    dailyTextMessages: 25,
    dailyVoiceMinutes: 10,
    dailyWritingGrades: 3,
    dailyPronunciationScores: 3,
    dailyLessonTtsPlays: 50,
    unlimitedHearts: true,
    streakShield: true,
    audiobookNarration: false,
    offlineMode: false,
  },
  premium: {
    name: 'Premium',
    priceMonthlyUsd: 19.99,
    dailyTextMessages: 50,
    dailyVoiceMinutes: 20,
    dailyWritingGrades: 7,
    dailyPronunciationScores: 5,
    dailyLessonTtsPlays: 100,
    unlimitedHearts: true,
    streakShield: true,
    audiobookNarration: false,
    offlineMode: true,
  },
  vip: {
    name: 'VIP',
    priceMonthlyUsd: 29.99,
    dailyTextMessages: 75,
    dailyVoiceMinutes: 30,
    dailyWritingGrades: 12,
    dailyPronunciationScores: 7,
    dailyLessonTtsPlays: 200,
    unlimitedHearts: true,
    streakShield: true,
    audiobookNarration: true,
    offlineMode: true,
  },
};

/** Feature bullet points for the subscription/pricing UI. */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  // "Unlimited hearts" is deliberately absent from every tier: hearts no
  // longer block anything (hooks/useHearts.ts), so listing it would be
  // selling a benefit that does not exist.
  //
  // `starter` lists what a free account actually gets, so declining the
  // paywall is an informed choice rather than a leap. Everything here is
  // something the app can serve at no marginal cost per learner; the AI tutor,
  // voice practice and writing grades are the things that aren't, and they are
  // the reason the paid rungs exist.
  starter: [
    'All lessons, reviews and reading',
    'Daily news in your language',
    'Streaks, XP and leagues',
    'One photo avatar, free',
  ],
  basic: [
    'All lessons, reviews and reading',
    '25 tutor messages per day',
    '10 minutes of voice practice per day',
    '3 writing grades per day',
    'Streak shield protection',
  ],
  premium: [
    'Everything in Basic',
    '50 tutor messages per day',
    '20 minutes of voice practice per day',
    '7 writing grades per day',
    'Offline mode',
  ],
  vip: [
    'Everything in Premium',
    '75 tutor messages per day',
    '30 minutes of voice practice per day',
    '12 writing grades per day',
    'Audiobook narration',
    'Priority support',
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
} {
  const plan = PLANS[planId as PlanId] ?? PLANS.starter;
  return {
    dailyTextMessages: plan.dailyTextMessages,
    dailyVoiceMinutes: plan.dailyVoiceMinutes,
    dailyWritingGrades: plan.dailyWritingGrades,
    dailyPronunciationScores: plan.dailyPronunciationScores,
    dailyLessonTtsPlays: plan.dailyLessonTtsPlays,
  };
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
