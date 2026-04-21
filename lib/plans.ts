/**
 * Central plan definitions — single source of truth for pricing, limits, and features.
 * Used by: subscription UI, stripe checkout, and mirrored in Edge Functions for enforcement.
 *
 * IMPORTANT: If you change limits here, also update the PLAN_LIMITS objects in:
 *   - supabase/functions/ai-chat/index.ts
 *   - supabase/functions/score-pronunciation/index.ts
 */

export type PlanId = 'free' | 'basic' | 'premium' | 'vip';

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
  free: {
    name: 'Free',
    priceMonthlyUsd: 0,
    dailyTextMessages: 5,
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
  free: [
    '5 text messages per day',
    '5 minutes of AI voice per day',
    '1 writing grade per day',
    '2 pronunciation scores per day',
    'Basic SRS review',
    '5 hearts per day',
  ],
  basic: [
    '25 text messages per day',
    '10 minutes of AI voice per day',
    '3 writing grades per day',
    '3 pronunciation scores per day',
    'Full SRS with adaptive scheduling',
    'Unlimited hearts',
    'Streak shield protection',
  ],
  premium: [
    '50 text messages per day',
    '20 minutes of AI voice per day',
    '7 writing grades per day',
    '5 pronunciation scores per day',
    'Full SRS with adaptive scheduling',
    'Unlimited hearts',
    'Streak shield protection',
    'Offline mode',
  ],
  vip: [
    '75 text messages per day',
    '30 minutes of AI voice per day',
    '12 writing grades per day',
    '7 pronunciation scores per day',
    'Full SRS with adaptive scheduling',
    'Unlimited hearts',
    'Streak shield protection',
    'Audiobook narration',
    'Offline mode',
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
  const plan = PLANS[planId as PlanId] ?? PLANS.free;
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
