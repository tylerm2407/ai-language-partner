import { supabase } from './supabase'

export type Plan = 'free' | 'pro' | 'family' | 'lifetime'

export async function getUserPlan(userId: string): Promise<Plan> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end')
    .eq('user_id', userId)
    .single()
  if (!data) return 'free'
  if (data.status !== 'active' && data.status !== 'trialing') return 'free'
  if (data.current_period_end && new Date(data.current_period_end) < new Date()) return 'free'
  return (data.plan as Plan) || 'free'
}

export function isPaid(plan: Plan): boolean {
  return plan === 'pro' || plan === 'family' || plan === 'lifetime'
}

export const PLAN_FEATURES = {
  free: {
    aiTutor: false,
    voiceMode: false,
    writingFeedback: false,
    newsAccess: true,
    musicAccess: true,
    conversationSessions: 0,
    dailyLessons: 3,
  },
  pro: {
    aiTutor: true,
    voiceMode: true,
    writingFeedback: true,
    newsAccess: true,
    musicAccess: true,
    conversationSessions: -1, // unlimited
    dailyLessons: -1,
  },
  family: {
    aiTutor: true,
    voiceMode: true,
    writingFeedback: true,
    newsAccess: true,
    musicAccess: true,
    conversationSessions: -1,
    dailyLessons: -1,
  },
  lifetime: {
    aiTutor: true,
    voiceMode: true,
    writingFeedback: true,
    newsAccess: true,
    musicAccess: true,
    conversationSessions: -1,
    dailyLessons: -1,
  },
}
