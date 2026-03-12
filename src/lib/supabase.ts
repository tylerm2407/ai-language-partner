// Re-export the auto-generated client so auth always uses the active Lovable Cloud project.
// Cast to any to keep compatibility with existing queries for tables not in generated TS types.
import { createClient } from '@supabase/supabase-js'

// Use env vars with hardcoded fallbacks to the correct Lovable Cloud project
// This ensures the correct project is used even if Vite has stale env var cache
const SUPABASE_URL = 'https://jktjclgfxdpkwhajwefj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdGpjbGdmeGRwa3doYWp3ZWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjUyNzUsImV4cCI6MjA4ODc0MTI3NX0.uoP5VymToea1_KCfxL2L5U6T2--sJchEh6SvsEQcXEs'

export const supabase: any = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
