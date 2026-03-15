-- 005: Security hardening — granular RLS policies
-- Replace overly broad FOR ALL policies with specific per-operation policies
-- ============================================================================

-- user_language_progress
DROP POLICY IF EXISTS "ulp_own" ON public.user_language_progress;
CREATE POLICY "ulp_select" ON public.user_language_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ulp_insert" ON public.user_language_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ulp_update" ON public.user_language_progress FOR UPDATE USING (auth.uid() = user_id);

-- user_lesson_progress
DROP POLICY IF EXISTS "ull_own" ON public.user_lesson_progress;
CREATE POLICY "ull_select" ON public.user_lesson_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ull_insert" ON public.user_lesson_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ull_update" ON public.user_lesson_progress FOR UPDATE USING (auth.uid() = user_id);

-- user_writing_submissions
DROP POLICY IF EXISTS "uws_own" ON public.user_writing_submissions;
CREATE POLICY "uws_select" ON public.user_writing_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "uws_insert" ON public.user_writing_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uws_update" ON public.user_writing_submissions FOR UPDATE USING (auth.uid() = user_id);

-- conversation_sessions
DROP POLICY IF EXISTS "cs_own" ON public.conversation_sessions;
CREATE POLICY "cs_select" ON public.conversation_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cs_insert" ON public.conversation_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cs_update" ON public.conversation_sessions FOR UPDATE USING (auth.uid() = user_id);

-- tutor_profiles
DROP POLICY IF EXISTS "tp_own" ON public.tutor_profiles;
CREATE POLICY "tp_select" ON public.tutor_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tp_insert" ON public.tutor_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tp_update" ON public.tutor_profiles FOR UPDATE USING (auth.uid() = user_id);

-- subscriptions
DROP POLICY IF EXISTS "sub_own" ON public.subscriptions;
CREATE POLICY "sub_select" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sub_insert" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sub_update" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- conversations
DROP POLICY IF EXISTS "conversations_own" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversations_update" ON public.conversations FOR UPDATE USING (auth.uid() = user_id);

-- user_achievements
DROP POLICY IF EXISTS "ua_own" ON public.user_achievements;
CREATE POLICY "ua_select" ON public.user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ua_insert" ON public.user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Profiles: ensure only owner can see full row (stripe_customer_id etc)
DROP POLICY IF EXISTS "profiles_own_full" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
