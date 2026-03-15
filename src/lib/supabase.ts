import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
})

export type Profile = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  target_language: string
  native_language: string
  level: 'beginner' | 'elementary' | 'intermediate' | 'advanced'
  xp: number
  total_xp: number
  streak_days: number
  last_practice_date: string | null
  daily_goal_xp: number
  today_xp: number
  hearts: number
  gems: number
  streak_freeze_count: number
  league: 'bronze' | 'silver' | 'gold' | 'diamond' | 'legendary'
  league_xp: number
  hearts_last_regen_at: string
  subscription_tier: 'free' | 'basic' | 'pro' | 'vip'
  subscription_plan: string | null
  subscription_expires_at: string | null
  stripe_customer_id?: string
  created_at: string
}

export type Message = {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  corrections?: string[]
}

export type Conversation = {
  id: string
  user_id: string
  language: string
  topic: string | null
  messages: Message[]
  xp_earned: number
  duration_seconds: number
  created_at: string
}
