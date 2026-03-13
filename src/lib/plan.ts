import { supabase } from './supabase'

export type Plan = 'free' | 'basic' | 'pro' | 'vip'

// Stripe product/price mapping
export const STRIPE_TIERS = {
  basic: {
    product_id: 'prod_U8qpS7xyjtrEfU',
    price_id: 'price_1TAZ7YAmUZkn8na4NDsEPHUV',
  },
  pro: {
    product_id: 'prod_U8qpnhjc9rwoec',
    price_id: 'price_1TAZ7qAmUZkn8na4iZatbbL6',
  },
  vip: {
    product_id: 'prod_U8qq8BoOQXTCm7',
    price_id: 'price_1TAZ98AmUZkn8na4lOhS6Pdh',
  },
} as const

export function productIdToPlan(productId: string): Plan {
  for (const [plan, info] of Object.entries(STRIPE_TIERS)) {
    if (info.product_id === productId) return plan as Plan
  }
  return 'free'
}

export function isPaid(plan: Plan): boolean {
  return plan === 'basic' || plan === 'pro' || plan === 'vip'
}

export const PLAN_FEATURES = {
  free: {
    aiTutor: false,
    voiceMode: false,
    writingFeedback: false,
    newsAccess: true,
    musicAccess: true,
    dailyAiMinutes: 0,
    dailyLessons: 3,
  },
  basic: {
    aiTutor: true,
    voiceMode: false,
    writingFeedback: true,
    newsAccess: true,
    musicAccess: true,
    dailyAiMinutes: 20,
    dailyLessons: -1,
  },
  pro: {
    aiTutor: true,
    voiceMode: true,
    writingFeedback: true,
    newsAccess: true,
    musicAccess: true,
    dailyAiMinutes: 45,
    dailyLessons: -1,
  },
  vip: {
    aiTutor: true,
    voiceMode: true,
    writingFeedback: true,
    newsAccess: true,
    musicAccess: true,
    dailyAiMinutes: 60,
    dailyLessons: -1,
  },
}
