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
  unlimitedHearts: boolean;
  streakShield: boolean;
  audiobookNarration: boolean;
  offlineMode: boolean;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  // `starter` is not a plan you can use — it is the ABSENCE of one. Every
  // signed-in user resolves to it via `subscription?.tier ?? 'starter'` until
  // they buy, and since the 7c paywall is a hard gate there is no free AI
  // allowance behind it. All AI quotas are therefore 0, and the router blocks
  // `(app)` entirely for this tier (app/(app)/_layout.tsx).
  //
  // The zeros are the server-side half of that gate: if the client gate were
  // ever bypassed, the edge functions must still refuse. A client that thinks
  // the gate is closed while the server grants quota is the migration-057
  // class of bug.
  //
  // Classroom students are the deliberate exception — they never buy a
  // personal subscription, and `get_effective_limits` merges their org's
  // contract_config with GREATEST(), so a 0 personal quota still yields the
  // school's allowance. Do not "fix" these zeros by restoring a free tier.
  starter: {
    name: 'No subscription',
    priceMonthlyUsd: 0,
    dailyTextMessages: 0,
    dailyVoiceMinutes: 0,
    dailyWritingGrades: 0,
    dailyPronunciationScores: 0,
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
  // `starter` lists nothing because it grants nothing. It renders only in the
  // profile subscription screen, as the state a lapsed subscriber lands in.
  starter: [],
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
} {
  const plan = PLANS[planId as PlanId] ?? PLANS.starter;
  return {
    dailyTextMessages: plan.dailyTextMessages,
    dailyVoiceMinutes: plan.dailyVoiceMinutes,
    dailyWritingGrades: plan.dailyWritingGrades,
    dailyPronunciationScores: plan.dailyPronunciationScores,
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
