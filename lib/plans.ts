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
  monthlyAILimits: {
    chat: number | 'unlimited';
    tutor_conversation: number | 'unlimited';
    writing_feedback: number | 'unlimited';
    pronunciation_feedback: number | 'unlimited';
  };
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    name: 'Free',
    priceMonthlyUsd: 0,
    dailyTextConversations: 5,
    dailyVoiceMinutes: 5,
    monthlyAILimits: {
      chat: 50,
      tutor_conversation: 10,
      writing_feedback: 10,
      pronunciation_feedback: 10,
    },
  },
  basic: {
    name: 'Basic',
    priceMonthlyUsd: 9.99,
    dailyTextConversations: 20,
    dailyVoiceMinutes: 20,
    monthlyAILimits: {
      chat: 300,
      tutor_conversation: 100,
      writing_feedback: 100,
      pronunciation_feedback: 100,
    },
  },
  premium: {
    name: 'Premium',
    priceMonthlyUsd: 19.99,
    dailyTextConversations: 'unlimited',
    dailyVoiceMinutes: 45,
    monthlyAILimits: {
      chat: 'unlimited',
      tutor_conversation: 500,
      writing_feedback: 500,
      pronunciation_feedback: 500,
    },
  },
  unlimited: {
    name: 'Unlimited',
    priceMonthlyUsd: 29.99,
    dailyTextConversations: 'unlimited',
    dailyVoiceMinutes: 60,
    monthlyAILimits: {
      chat: 'unlimited',
      tutor_conversation: 'unlimited',
      writing_feedback: 'unlimited',
      pronunciation_feedback: 'unlimited',
    },
  },
};

/** Feature bullet points for the subscription/pricing UI. */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  free: [
    'Full reading library (all levels)',
    'All non-AI exercises & SRS review',
    '5 AI text conversations per day',
    '5 minutes of AI voice per day',
    '10 writing feedback & pronunciation scores per month',
    'Offline reading downloads',
  ],
  basic: [
    'Everything in Free, plus:',
    '20 AI text conversations per day',
    '20 minutes of AI voice per day',
    '100 writing feedback & pronunciation scores per month',
    'Full SRS with adaptive scheduling',
  ],
  premium: [
    'Everything in Basic, plus:',
    'Unlimited AI text conversations',
    '45 minutes of AI voice per day',
    '500 writing & pronunciation feedbacks per month',
    'Offline mode for all content',
  ],
  unlimited: [
    'Everything in Premium, plus:',
    '60 minutes of AI voice per day',
    'Unlimited AI across all features',
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
