-- Migration: Add daily_usage table for per-user daily quota tracking.
-- Also update subscriptions tier check to support new plan tiers.

-- ─── Daily Usage ────────────────────────────────────────────────

CREATE TABLE public.daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  text_messages INTEGER NOT NULL DEFAULT 0,
  voice_minutes NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_usage_user_date ON public.daily_usage(user_id, date);

-- ─── Update subscriptions tier constraint ───────────────────────
-- Add 'basic' and 'unlimited' tiers to the allowed values.

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('free', 'basic', 'premium', 'unlimited'));
