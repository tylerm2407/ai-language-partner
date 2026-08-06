-- 058_scope_policies_to_authenticated.sql
--
-- Stage B of the RLS cleanup: give every remaining owner-scoped policy an
-- explicit `TO authenticated`.
--
-- A policy declared without a TO clause applies to the `public` role, meaning
-- Postgres evaluates it for EVERY role — including `anon` — on every query.
-- That is why the performance advisor reported "multiple permissive policies
-- for role anon" on tables an anonymous user can never reach.
--
-- This is a narrowing change and cannot widen access. Each policy below is
-- already gated on `auth.uid()` or a membership helper, both of which are NULL
-- or false for `anon` — so anon gets nothing today and nothing after. The two
-- exceptions with `USING (true)` (content_sources, grammar_rules) were checked
-- individually: grammar_rules is read only inside a lesson via RuleCard, and
-- fetchContentSources has no callers in the app at all. Neither is reachable
-- before sign-in.
--
-- ALTER POLICY is used rather than DROP + CREATE: it swaps the role list
-- atomically, with no window in which the table sits unprotected.
--
-- subscriptions is absent here — both of its policies were handled in 057.

ALTER POLICY "Users can insert own achievements" ON public.achievements TO authenticated;
ALTER POLICY "Users can read own achievements" ON public.achievements TO authenticated;

ALTER POLICY "Students can insert own submissions" ON public.assignment_submissions TO authenticated;
ALTER POLICY "Students can select own submissions" ON public.assignment_submissions TO authenticated;
ALTER POLICY "Teachers can read submissions for their assignments" ON public.assignment_submissions TO authenticated;
ALTER POLICY "Students can update own submissions" ON public.assignment_submissions TO authenticated;
ALTER POLICY "Teachers can update submissions for grading" ON public.assignment_submissions TO authenticated;

ALTER POLICY "Teachers can delete own assignments" ON public.assignments TO authenticated;
ALTER POLICY "Teachers can insert own assignments" ON public.assignments TO authenticated;
ALTER POLICY "Students can read published assignments for enrolled classes" ON public.assignments TO authenticated;
ALTER POLICY "Teachers can select own assignments" ON public.assignments TO authenticated;
ALTER POLICY "Teachers can update own assignments" ON public.assignments TO authenticated;

ALTER POLICY "Org admins can read org audit logs" ON public.audit_log TO authenticated;

ALTER POLICY "Users can manage own chat messages" ON public.chat_messages TO authenticated;
ALTER POLICY "Teachers can read assignment chat messages" ON public.chat_messages TO authenticated;

ALTER POLICY "Users can manage own chat sessions" ON public.chat_sessions TO authenticated;
ALTER POLICY "Teachers can read assignment chat sessions" ON public.chat_sessions TO authenticated;

ALTER POLICY "Students can insert own enrollments" ON public.classroom_enrollments TO authenticated;
ALTER POLICY "Students can read own enrollments" ON public.classroom_enrollments TO authenticated;
ALTER POLICY "Teachers can read enrollments for their classes" ON public.classroom_enrollments TO authenticated;
ALTER POLICY "Teachers can update enrollments for their classes" ON public.classroom_enrollments TO authenticated;

ALTER POLICY "Teachers can insert own classrooms" ON public.classrooms TO authenticated;
ALTER POLICY "Enrolled students can read classrooms" ON public.classrooms TO authenticated;
ALTER POLICY "Org admins can read all classrooms in org" ON public.classrooms TO authenticated;
ALTER POLICY "Teachers can select own classrooms" ON public.classrooms TO authenticated;
ALTER POLICY "Teachers can update own classrooms" ON public.classrooms TO authenticated;

ALTER POLICY "content_sources_read_all" ON public.content_sources TO authenticated;

ALTER POLICY "Users can read own correction log" ON public.correction_log TO authenticated;

ALTER POLICY "Users can insert own challenges" ON public.daily_challenges TO authenticated;
ALTER POLICY "Users can read own challenges" ON public.daily_challenges TO authenticated;
ALTER POLICY "Users can update own challenges" ON public.daily_challenges TO authenticated;

ALTER POLICY "Users can manage own daily stats" ON public.daily_stats TO authenticated;

ALTER POLICY "grammar_rules_read_all" ON public.grammar_rules TO authenticated;

ALTER POLICY "Users can manage own lesson completions" ON public.lesson_completions TO authenticated;
ALTER POLICY "Users can insert own completions" ON public.lesson_completions TO authenticated;
ALTER POLICY "Users can read own completions" ON public.lesson_completions TO authenticated;
ALTER POLICY "Users can update own completions" ON public.lesson_completions TO authenticated;

ALTER POLICY "Members can read other members in same org" ON public.organization_members TO authenticated;
ALTER POLICY "Users can read own memberships" ON public.organization_members TO authenticated;

ALTER POLICY "Org members can read their organization" ON public.organizations TO authenticated;

ALTER POLICY "Users can manage own practice sessions" ON public.practice_sessions TO authenticated;

ALTER POLICY "Users can manage own review items" ON public.review_items TO authenticated;

ALTER POLICY "Users can manage own review logs" ON public.review_logs TO authenticated;

ALTER POLICY "Users can insert own streak events" ON public.streak_events TO authenticated;
ALTER POLICY "Users can read own streak events" ON public.streak_events TO authenticated;

ALTER POLICY "Users can insert their own daily news" ON public.user_daily_news TO authenticated;
ALTER POLICY "Users can read their own daily news" ON public.user_daily_news TO authenticated;

ALTER POLICY "own reads insert" ON public.user_news_reads TO authenticated;
ALTER POLICY "own reads select" ON public.user_news_reads TO authenticated;

ALTER POLICY "Users can insert own profile" ON public.user_profiles TO authenticated;
ALTER POLICY "Users can read own profile" ON public.user_profiles TO authenticated;
ALTER POLICY "Users can update own profile" ON public.user_profiles TO authenticated;

ALTER POLICY "Users can manage own reading progress" ON public.user_reading_progress TO authenticated;

ALTER POLICY "Users can read own roles" ON public.user_roles TO authenticated;

ALTER POLICY "Users can manage own writing submissions" ON public.user_writing_submissions TO authenticated;
