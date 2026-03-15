-- 008: Additional RLS fixes from security audit
-- ============================================================================

-- ai_response_cache: enable RLS, no public policies (service role only)
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

-- ai_usage_log: enable RLS, users can only read their own usage
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_log_select" ON public.ai_usage_log FOR SELECT USING (auth.uid() = user_id);

-- achievements: enable RLS, read-only for all authenticated users
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements_select" ON public.achievements FOR SELECT USING (true);

-- srs_cards: replace FOR ALL with granular policies
DROP POLICY IF EXISTS "srs_cards_own" ON public.srs_cards;
CREATE POLICY "srs_cards_select" ON public.srs_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "srs_cards_insert" ON public.srs_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "srs_cards_update" ON public.srs_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "srs_cards_delete" ON public.srs_cards FOR DELETE USING (auth.uid() = user_id);

-- srs_reviews: replace FOR ALL with granular policies
DROP POLICY IF EXISTS "srs_reviews_own" ON public.srs_reviews;
CREATE POLICY "srs_reviews_select" ON public.srs_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "srs_reviews_insert" ON public.srs_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
