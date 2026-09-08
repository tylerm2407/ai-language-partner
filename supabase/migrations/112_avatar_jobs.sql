-- 112 — Avatar generation becomes a job, not a request.
--
-- Why: gpt-image-2 at quality 'high' takes 100–235 seconds for a 1024px edit.
-- The client's edge-function budget is 60s (lib/supabase.ts) and the function
-- aborted the provider call at 120s, so every 'high' generation died twice:
-- the learner saw "Failed to send a request to the Edge Function" at 60s,
-- and the server logged "image API call failed: timeout" at 120s. No
-- synchronous request can hold for four minutes on a phone, so generate-avatar
-- now answers immediately with a job id, finishes the render in a background
-- task (EdgeRuntime.waitUntil, inside the Pro plan's 400s wall clock), and the
-- client polls this table until the job settles.
--
-- Postgres rather than Redis on purpose: the row is small, the client reads it
-- directly under RLS (no function boot per poll), and a job's outcome is
-- something we want to be able to see when a learner says "it never finished".
-- Rows are pruned per user by the function; the table cannot grow past a few
-- rows per account.
--
-- Applied to production 2026-09-08.

CREATE TABLE public.avatar_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  style_key     text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'done', 'failed')),
  -- Set when status = 'done': the object path inside the private `avatars`
  -- bucket, already attached to user_profiles.avatar_image_path.
  avatar_path   text,
  -- Set when status = 'failed'. Same codes the synchronous response used to
  -- carry (IMAGE_REJECTED, GENERATION_FAILED, GENERATION_TIMEOUT, ...).
  error_code    text,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.avatar_jobs IS
  'One row per photo-to-avatar generation. Written only by the generate-avatar '
  'edge function (service role); clients read their own rows to poll progress. '
  'The source photo is never stored here or anywhere else.';

CREATE INDEX avatar_jobs_user_created_idx
  ON public.avatar_jobs (user_id, created_at DESC);

ALTER TABLE public.avatar_jobs ENABLE ROW LEVEL SECURITY;

-- Read-only for the owner. No INSERT/UPDATE policy: a job is created and
-- settled by the service role, and a client that could write its own row could
-- mark a job 'done' with an arbitrary path.
CREATE POLICY "avatar_jobs_select_own" ON public.avatar_jobs
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);
