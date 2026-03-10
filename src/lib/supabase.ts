import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
  subscription_tier: 'free' | 'pro' | 'family'
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
