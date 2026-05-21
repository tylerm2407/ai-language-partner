-- Fix: Prevent students from modifying grading columns on their own submissions.
--
-- The original RLS policy "Students can update own submissions" allowed students
-- to update ANY column (auto_score, ai_feedback, teacher_score, final_score,
-- graded_at, teacher_feedback). Since Supabase RLS does not support column-level
-- restrictions, we use a BEFORE UPDATE trigger to block changes to grading fields
-- when the caller is the student.
--
-- Teacher updates are unaffected — the trigger only fires when OLD.student_id
-- matches the current auth.uid().

-- 1. Create validation function
CREATE OR REPLACE FUNCTION public.check_student_submission_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only restrict students (when the row belongs to the current user)
  IF OLD.student_id = auth.uid() THEN
    IF NEW.auto_score IS DISTINCT FROM OLD.auto_score THEN
      RAISE EXCEPTION 'Students cannot modify auto_score';
    END IF;
    IF NEW.ai_feedback IS DISTINCT FROM OLD.ai_feedback THEN
      RAISE EXCEPTION 'Students cannot modify ai_feedback';
    END IF;
    IF NEW.teacher_score IS DISTINCT FROM OLD.teacher_score THEN
      RAISE EXCEPTION 'Students cannot modify teacher_score';
    END IF;
    IF NEW.teacher_feedback IS DISTINCT FROM OLD.teacher_feedback THEN
      RAISE EXCEPTION 'Students cannot modify teacher_feedback';
    END IF;
    IF NEW.final_score IS DISTINCT FROM OLD.final_score THEN
      RAISE EXCEPTION 'Students cannot modify final_score';
    END IF;
    IF NEW.graded_at IS DISTINCT FROM OLD.graded_at THEN
      RAISE EXCEPTION 'Students cannot modify graded_at';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Attach trigger to assignment_submissions
DROP TRIGGER IF EXISTS check_student_submission_update_trigger ON public.assignment_submissions;
CREATE TRIGGER check_student_submission_update_trigger
  BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_student_submission_update();
