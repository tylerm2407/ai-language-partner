// Re-export the auto-generated client so auth always uses the active Lovable Cloud project.
// Cast to any to keep compatibility with existing queries for tables not in generated TS types.
import { supabase as generatedSupabase } from '@/integrations/supabase/client'

// Debug: verify correct project URL is being used
console.log('[supabase] URL:', import.meta.env.VITE_SUPABASE_URL)

export const supabase: any = generatedSupabase

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
