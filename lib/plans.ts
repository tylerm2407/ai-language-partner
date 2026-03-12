/**
 * Central plan definitions — single source of truth for pricing, limits, and features.
 * Used by: subscription UI, stripe checkout, and mirrored in Edge Functions for enforcement.
 *
 * IMPORTANT: If you change limits here, also update the PLAN_LIMITS objects in:
 *   - supabase/functions/ai-chat/index.ts
 *   - supabase/functions/score-pronunciation/index.ts
 */

export type PlanId = 'free' | 'basic' | 'premium' | 'unlimited';

export interface PlanDefinition {
  name: string;
  priceMonthlyUsd: number;
  dailyTextConversations: number | 'unlimited';
  dailyVoiceMinutes: number | 'unlimited';
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    name: 'Free',
    priceMonthlyUsd: 0,
    dailyTextConversations: 5,
    dailyVoiceMinutes: 5,
  },
  basic: {
    name: 'Basic',
    priceMonthlyUsd: 9.99,
    dailyTextConversations: 20,
    dailyVoiceMinutes: 20,
  },
  premium: {
    name: 'Premium',
    priceMonthlyUsd: 19.99,
    dailyTextConversations: 'unlimited',
    dailyVoiceMinutes: 45,
  },
  unlimited: {
    name: 'Unlimited',
    priceMonthlyUsd: 29.99,
    dailyTextConversations: 'unlimited',
    dailyVoiceMinutes: 60,
  },
};

/** Feature bullet points for the subscription/pricing UI. */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free: [
    '5 text conversations per day',
    '5 minutes of AI voice per day',
    'Basic SRS review',
  ],
  basic: [
    '20 text conversations per day',
    '20 minutes of AI voice per day',
    'Full SRS with adaptive scheduling',
    'Speaking & pronunciation scoring',
  ],
  premium: [
    'Unlimited text conversations',
    '45 minutes of AI voice per day',
    'Full SRS with adaptive scheduling',
    'Speaking & pronunciation scoring',
    'Offline mode',
  ],
  unlimited: [
    'Unlimited text conversations',
    '60 minutes of AI voice per day',
    'Full SRS with adaptive scheduling',
    'Speaking & pronunciation scoring',
    'Offline mode',
    'Priority support',
  ],
};

/**
 * Return numeric limits for a given plan, suitable for backend enforcement.
 * Converts "unlimited" to Infinity for easy comparison.
 */
export function getPlanLimits(planId: PlanId | string): {
  dailyTextConversations: number;
  dailyVoiceMinutes: number;
} {
  const plan = PLANS[planId as PlanId] ?? PLANS.free;
  return {
    dailyTextConversations: plan.dailyTextConversations === 'unlimited' ? Infinity : plan.dailyTextConversations,
    dailyVoiceMinutes: plan.dailyVoiceMinutes === 'unlimited' ? Infinity : plan.dailyVoiceMinutes,
  };
}

/** Stripe price keys used in checkout and webhook handling. */
export const STRIPE_PRICE_KEYS = {
  basic_monthly: 'basic_monthly',
  basic_yearly: 'basic_yearly',
  premium_monthly: 'premium_monthly',
  premium_yearly: 'premium_yearly',
  unlimited_monthly: 'unlimited_monthly',
  unlimited_yearly: 'unlimited_yearly',
} as const;
