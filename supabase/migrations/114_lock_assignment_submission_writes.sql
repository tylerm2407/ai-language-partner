-- 114 — Make assignment submission state server-owned.
--
-- Legitimate create/submit/grade operations already go through the school
-- edge function, whose service-role client bypasses RLS after the function
-- authenticates and authorizes the caller. Authenticated PostgREST clients
-- therefore need SELECT only, never direct INSERT/UPDATE.

BEGIN;

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- F14 containment: remove every known authenticated write route. Keep the
-- existing owner/teacher SELECT policies intact.
DROP POLICY IF EXISTS "Students can insert own submissions"
  ON public.assignment_submissions;
DROP POLICY IF EXISTS "Students can update own submissions"
  ON public.assignment_submissions;
DROP POLICY IF EXISTS "Teachers can update submissions for grading"
  ON public.assignment_submissions;

-- Defense in depth: if a future permissive policy accidentally restores direct
-- writes, a JWT-authenticated database caller still cannot write this table.
-- The trusted school function uses a service-role client without an end-user
-- JWT; auth.uid() is NULL on that database connection.
CREATE OR REPLACE FUNCTION public.reject_client_submission_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION
      'assignment submissions are server-managed'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.reject_client_submission_writes()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reject_client_submission_writes_trigger
  ON public.assignment_submissions;
CREATE TRIGGER reject_client_submission_writes_trigger
  BEFORE INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_client_submission_writes();

DO $postflight$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'assignment_submissions'
       AND cmd IN ('INSERT', 'UPDATE', 'ALL')
       AND (
         'public'::name = ANY (roles)
         OR 'authenticated'::name = ANY (roles)
       )
  ) THEN
    RAISE EXCEPTION
      'submission lockdown postflight failed: client write policy remains';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgrelid = 'public.assignment_submissions'::regclass
       AND tgname = 'reject_client_submission_writes_trigger'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'submission lockdown postflight failed: guard trigger missing';
  END IF;
END;
$postflight$;

COMMIT;
