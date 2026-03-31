-- Migration 005: Update subscription tiers (pro/vip) and add AI chat minute tracking.
-- Run: npx supabase db push

-- ═══════════════════════════════════════════════════════════════
-- 1. UPDATE SUBSCRIPTION TIERS
-- ═══════════════════════════════════════════════════════════════

-- Drop old tier constraint and add updated one with pro/vip tiers.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('free', 'basic', 'pro', 'vip'));

-- Migrate existing data: premium → pro, unlimited → vip
UPDATE public.subscriptions SET tier = 'pro' WHERE tier = 'premium';
UPDATE public.subscriptions SET tier = 'vip' WHERE tier = 'unlimited';

-- Add missing columns for richer subscription tracking
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ═══════════════════════════════════════════════════════════════
-- 2. ADD AI CHAT MINUTES TO DAILY USAGE
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS ai_chat_minutes NUMERIC NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════
-- 3. UPDATE ATOMIC INCREMENT FUNCTION
-- ═══════════════════════════════════════════════════════════════

-- Replace the increment function to support ai_chat_minutes
CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_user_id UUID,
  p_date DATE,
  p_text_messages INT DEFAULT 0,
  p_voice_minutes REAL DEFAULT 0,
  p_ai_chat_minutes REAL DEFAULT 0
) RETURNS TABLE(text_messages INT, voice_minutes REAL, ai_chat_minutes REAL) AS $$
BEGIN
  INSERT INTO public.daily_usage (user_id, date, text_messages, voice_minutes, ai_chat_minutes)
  VALUES (p_user_id, p_date, p_text_messages, p_voice_minutes, p_ai_chat_minutes)
  ON CONFLICT (user_id, date) DO UPDATE SET
    text_messages = daily_usage.text_messages + EXCLUDED.text_messages,
    voice_minutes = daily_usage.voice_minutes + EXCLUDED.voice_minutes,
    ai_chat_minutes = daily_usage.ai_chat_minutes + EXCLUDED.ai_chat_minutes;

  RETURN QUERY
    SELECT du.text_messages, du.voice_minutes::REAL, du.ai_chat_minutes::REAL
    FROM public.daily_usage du
    WHERE du.user_id = p_user_id AND du.date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- 4. DAILY USAGE RLS (ensure it's enabled for the new column)
-- ═══════════════════════════════════════════════════════════════

-- RLS was already enabled in migration 004, this is a safety net
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_usage') THEN
    EXECUTE 'ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
