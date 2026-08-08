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
  // `starter` is the tier every signed-in user has before they buy anything
  // (`subscription?.tier ?? 'starter'`), and it has no Stripe price key — it is
  // the free plan. It used to carry a $3.79 price and the name "Starter", so a
  // free user saw only priced cards and no indication any of this was free.
  // That ambiguity is the mechanism behind the "nothing is free as it says"
  // complaint that dominates negative reviews across this category.
  starter: {
    name: 'Free',
    priceMonthlyUsd: 0,
    dailyTextMessages: 10,
    dailyVoiceMinutes: 5,
    dailyWritingGrades: 1,
    dailyPronunciationScores: 2,
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
  // Lessons, reviews and reading are unlimited on every tier including free —
  // the paid tiers buy AI capacity, not access to learning. "Unlimited hearts"
  // is deliberately absent: hearts no longer block anything on any tier
  // (hooks/useHearts.ts), so listing it would be selling a benefit that does
  // not exist.
  starter: [
    'All lessons, reviews and reading',
    'Your CEFR proficiency report',
    '10 tutor messages per day',
    '5 minutes of voice practice per day',
    '1 writing grade per day',
  ],
  basic: [
    'Everything in Free',
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
