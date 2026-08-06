-- 053_ai_content_reports.sql
-- In-app reporting of offensive / harmful AI output.
-- Required by Google Play's Generative AI policy: apps with AI-generated content
-- must provide an in-app mechanism for users to flag offensive output, and must
-- use those reports to inform filtering.
--
-- Reports are append-only from the client's perspective: a user may create and
-- read their own reports, but never edit or delete them (an editable report log
-- is not evidence). Review happens via service role / dashboard.

CREATE TABLE IF NOT EXISTS public.ai_content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Which AI surface produced the content.
  surface text NOT NULL CHECK (surface IN ('chat', 'writing', 'voice', 'reading', 'story', 'hint', 'news')),
  -- Why the user flagged it.
  reason text NOT NULL CHECK (reason IN ('offensive', 'harmful', 'sexual', 'inaccurate', 'nonsense', 'other')),
  -- The reported output, truncated client-side. Bounded so a report cannot be
  -- used as free unbounded storage.
  reported_content text NOT NULL CHECK (char_length(reported_content) <= 4000),
  -- Optional free-text detail from the user.
  user_comment text CHECK (user_comment IS NULL OR char_length(user_comment) <= 1000),
  -- Non-identifying context to help reproduce (language, level, session id...).
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ai_content_reports_status_created_idx
  ON public.ai_content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_content_reports_user_idx
  ON public.ai_content_reports (user_id, created_at DESC);

ALTER TABLE public.ai_content_reports ENABLE ROW LEVEL SECURITY;

-- Owner may file a report.
DROP POLICY IF EXISTS "Users can file own AI reports" ON public.ai_content_reports;
CREATE POLICY "Users can file own AI reports"
  ON public.ai_content_reports
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Owner may read their own reports (so the UI can confirm receipt).
DROP POLICY IF EXISTS "Users can read own AI reports" ON public.ai_content_reports;
CREATE POLICY "Users can read own AI reports"
  ON public.ai_content_reports
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- No UPDATE or DELETE policy: reports are immutable to clients by omission.

COMMENT ON TABLE public.ai_content_reports IS
  'User reports of offensive or harmful AI-generated output. Required by Google Play generative-AI policy. Append-only from clients; triage via service role.';
