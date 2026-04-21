-- ============================================================================
-- Migration: Fix remaining RLS recursion cycles in school-system tables.
-- ============================================================================
-- After 024 fixed organization_members, the next cycle surfaced between
-- classrooms <-> classroom_enrollments (two policies that subquery each other).
-- Several other policies (assignments, assignment_submissions, chat_sessions,
-- chat_messages) cross-reference tables in that cycle and inherit the loop.
--
-- Fix: wrap every cross-table membership/ownership check in a SECURITY DEFINER
-- function. The function body bypasses RLS on the inner SELECT, so the policy
-- engine never re-enters itself while evaluating any single policy.
-- ============================================================================

-- ─── Helpers ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_teacher_of_classroom(classroom_id_param UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms
    WHERE id = classroom_id_param
      AND teacher_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled_in_classroom(classroom_id_param UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classroom_enrollments
    WHERE classroom_id = classroom_id_param
      AND student_id = auth.uid()
      AND dropped_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_assignment(assignment_id_param UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments
    WHERE id = assignment_id_param
      AND teacher_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_chat_session(session_id_param UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_sessions cs
    JOIN public.assignments a ON a.id = cs.assignment_id
    WHERE cs.id = session_id_param
      AND a.teacher_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_teacher_of_classroom(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_enrolled_in_classroom(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_teacher_of_assignment(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_teacher_of_chat_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_classroom(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enrolled_in_classroom(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_assignment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_chat_session(UUID) TO authenticated;

-- ─── classrooms ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enrolled students can read classrooms" ON public.classrooms;
CREATE POLICY "Enrolled students can read classrooms"
  ON public.classrooms FOR SELECT
  USING (public.is_enrolled_in_classroom(id));

-- ─── classroom_enrollments ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can read enrollments for their classes"
  ON public.classroom_enrollments;
CREATE POLICY "Teachers can read enrollments for their classes"
  ON public.classroom_enrollments FOR SELECT
  USING (public.is_teacher_of_classroom(classroom_id));

DROP POLICY IF EXISTS "Teachers can update enrollments for their classes"
  ON public.classroom_enrollments;
CREATE POLICY "Teachers can update enrollments for their classes"
  ON public.classroom_enrollments FOR UPDATE
  USING (public.is_teacher_of_classroom(classroom_id));

-- ─── assignments ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Students can read published assignments for enrolled classes"
  ON public.assignments;
CREATE POLICY "Students can read published assignments for enrolled classes"
  ON public.assignments FOR SELECT
  USING (
    status = 'published'
    AND public.is_enrolled_in_classroom(classroom_id)
  );

-- ─── assignment_submissions ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can read submissions for their assignments"
  ON public.assignment_submissions;
CREATE POLICY "Teachers can read submissions for their assignments"
  ON public.assignment_submissions FOR SELECT
  USING (public.is_teacher_of_assignment(assignment_id));

DROP POLICY IF EXISTS "Teachers can update submissions for grading"
  ON public.assignment_submissions;
CREATE POLICY "Teachers can update submissions for grading"
  ON public.assignment_submissions FOR UPDATE
  USING (public.is_teacher_of_assignment(assignment_id));

-- ─── chat_sessions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can read assignment chat sessions"
  ON public.chat_sessions;
CREATE POLICY "Teachers can read assignment chat sessions"
  ON public.chat_sessions FOR SELECT
  USING (
    assignment_id IS NOT NULL
    AND public.is_teacher_of_assignment(assignment_id)
  );

-- ─── chat_messages ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Teachers can read assignment chat messages"
  ON public.chat_messages;
CREATE POLICY "Teachers can read assignment chat messages"
  ON public.chat_messages FOR SELECT
  USING (public.is_teacher_of_chat_session(session_id));
