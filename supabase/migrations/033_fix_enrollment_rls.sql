-- Fix: Require classroom to have active invite code for student self-enrollment.
--
-- The original policy allowed ANY student to insert an enrollment row for ANY
-- classroom as long as student_id = auth.uid(). The actual invite code validation
-- happens in the school edge function (joinClassroom), but the RLS policy should
-- be a safety net that prevents direct DB inserts from bypassing the invite flow.
--
-- We cannot compare the invite code value in RLS (it's a request-time parameter,
-- not a column), but we CAN ensure the classroom exists and has enrollment open.

DROP POLICY IF EXISTS "Students can insert own enrollments" ON public.classroom_enrollments;

CREATE POLICY "Students can insert own enrollments"
  ON public.classroom_enrollments FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_id
        AND c.invite_code_active = true
        AND c.archived = false
    )
  );
