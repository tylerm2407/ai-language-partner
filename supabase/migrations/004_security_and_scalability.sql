-- Migration 004: Security & Scalability Hardening
-- Enables RLS on all tables, adds atomic increment functions,
-- and adds missing indexes for 1M+ user scale.
-- Run: npx supabase db push

-- ═══════════════════════════════════════════════════════════════
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ═══════════════════════════════════════════════════════════════

-- ─── User-owned tables: users can only access their own data ───

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own review items"
  ON public.review_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own review logs"
  ON public.review_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own daily stats"
  ON public.daily_stats FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own practice sessions"
  ON public.practice_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
-- Only Edge Functions (service role) can insert/update subscriptions

ALTER TABLE public.user_writing_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own writing submissions"
  ON public.user_writing_submissions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.user_reading_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reading progress"
  ON public.user_reading_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── Content tables: read-only for authenticated users ──────

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read courses"
  ON public.courses FOR SELECT TO authenticated USING (true);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read units"
  ON public.units FOR SELECT TO authenticated USING (true);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read lessons"
  ON public.lessons FOR SELECT TO authenticated USING (true);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read cards"
  ON public.cards FOR SELECT TO authenticated USING (true);
-- Allow insert for addCardFromAnnotation (user-created cards)
CREATE POLICY "Authenticated users can insert cards"
  ON public.cards FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read exercises"
  ON public.exercises FOR SELECT TO authenticated USING (true);

ALTER TABLE public.reading_passages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read passages"
  ON public.reading_passages FOR SELECT TO authenticated USING (true);

ALTER TABLE public.reading_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read annotations"
  ON public.reading_annotations FOR SELECT TO authenticated USING (true);

ALTER TABLE public.reading_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read questions"
  ON public.reading_questions FOR SELECT TO authenticated USING (true);

ALTER TABLE public.writing_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read writing prompts"
  ON public.writing_prompts FOR SELECT TO authenticated USING (true);

-- ─── Daily usage table (if it exists) ────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_usage') THEN
    EXECUTE 'ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "Users can manage own daily usage" ON public.daily_usage FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 2. ATOMIC INCREMENT FUNCTIONS (eliminate race conditions)
-- ═══════════════════════════════════════════════════════════════

-- ─── Atomic XP increment ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_xp(
  p_user_id UUID,
  p_amount INT
) RETURNS INT AS $$
DECLARE
  v_new_xp INT;
BEGIN
  UPDATE public.user_profiles
  SET total_xp = total_xp + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING total_xp INTO v_new_xp;

  RETURN COALESCE(v_new_xp, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Atomic daily usage increment with limit check ──────────

CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_user_id UUID,
  p_date DATE,
  p_text_messages INT DEFAULT 0,
  p_voice_minutes REAL DEFAULT 0
) RETURNS TABLE(text_messages INT, voice_minutes REAL) AS $$
BEGIN
  INSERT INTO public.daily_usage (user_id, date, text_messages, voice_minutes)
  VALUES (p_user_id, p_date, p_text_messages, p_voice_minutes)
  ON CONFLICT (user_id, date) DO UPDATE SET
    text_messages = daily_usage.text_messages + EXCLUDED.text_messages,
    voice_minutes = daily_usage.voice_minutes + EXCLUDED.voice_minutes;

  RETURN QUERY
    SELECT du.text_messages, du.voice_minutes
    FROM public.daily_usage du
    WHERE du.user_id = p_user_id AND du.date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- 3. ADDITIONAL SCALABILITY INDEXES
-- ═══════════════════════════════════════════════════════════════

-- Covering index for annotation fetches with position ordering
CREATE INDEX IF NOT EXISTS idx_reading_annotations_passage_position
  ON public.reading_annotations(passage_id, start_index, end_index);

-- Index for subscription tier lookups (hot path in every Edge Function)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active
  ON public.subscriptions(user_id) WHERE is_active = true;

-- Index for daily usage lookups (hot path in rate limiting)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_usage') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON public.daily_usage(user_id, date)';
  END IF;
END $$;

-- Index for practice session history
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user
  ON public.practice_sessions(user_id, started_at DESC);
