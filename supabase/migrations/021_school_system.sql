-- Fluenci for Schools: roles, organizations, classrooms, assignments, submissions
-- Adds multi-tenant school support with teacher dashboards, classroom management,
-- assignment workflows, and merged personal + school usage limits.

-- ============================================================================
-- Section 1: User Roles
-- ============================================================================

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('learner', 'teacher', 'school_admin')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(user_id, role)
);

-- ============================================================================
-- Section 2: Organizations
-- ============================================================================

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  contact_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  max_seats INT NOT NULL DEFAULT 50,
  contract_config JSONB NOT NULL DEFAULT '{
    "dailyVoiceMinutes": 20,
    "dailyTextMessages": 50,
    "dailyWritingGrades": 7,
    "dailyPronunciationScores": 5,
    "unlimitedHearts": true,
    "streakShield": true,
    "audiobookNarration": false
  }'::jsonb,
  contract_start DATE,
  contract_end DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Section 3: Organization Members
-- ============================================================================

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_role TEXT NOT NULL CHECK (org_role IN ('admin', 'teacher', 'student')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- ============================================================================
-- Section 4: Classrooms
-- ============================================================================

CREATE TABLE public.classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_language TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'beginner'
    CHECK (level IN ('beginner', 'elementary', 'intermediate', 'upper_intermediate', 'advanced')),
  invite_code TEXT NOT NULL UNIQUE,
  invite_code_active BOOLEAN NOT NULL DEFAULT TRUE,
  max_students INT NOT NULL DEFAULT 35,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Section 5: Classroom Enrollments
-- ============================================================================

CREATE TABLE public.classroom_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dropped_at TIMESTAMPTZ,
  UNIQUE(classroom_id, student_id)
);

-- ============================================================================
-- Section 6: Assignments
-- ============================================================================

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  scenario_key TEXT,
  custom_scenario JSONB,
  target_language TEXT NOT NULL,
  level TEXT NOT NULL,
  min_duration_minutes INT NOT NULL DEFAULT 15,
  mode TEXT NOT NULL DEFAULT 'either' CHECK (mode IN ('text', 'voice', 'either')),
  vocabulary_focus TEXT[] DEFAULT '{}',
  grammar_focus TEXT[] DEFAULT '{}',
  instructions TEXT DEFAULT '',
  published_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  late_submission_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  max_points INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Section 7: Assignment Submissions
-- ============================================================================

CREATE TABLE public.assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'submitted', 'graded', 'returned')),
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  chat_session_id UUID REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  conversation_duration_minutes NUMERIC,
  auto_score NUMERIC,
  teacher_score NUMERIC,
  final_score NUMERIC,
  teacher_feedback TEXT,
  ai_feedback JSONB,
  is_late BOOLEAN NOT NULL DEFAULT FALSE,
  graded_at TIMESTAMPTZ,
  UNIQUE(assignment_id, student_id)
);

-- ============================================================================
-- Section 8: ALTER chat_sessions (link to assignments and classrooms)
-- ============================================================================

ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL;

-- ============================================================================
-- Section 9: Helper Functions
-- ============================================================================

-- Check if a user is the teacher of a given classroom
CREATE OR REPLACE FUNCTION public.is_classroom_teacher(p_user_id UUID, p_classroom_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms
    WHERE id = p_classroom_id AND teacher_id = p_user_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if a user is an active student in a given classroom
CREATE OR REPLACE FUNCTION public.is_classroom_student(p_user_id UUID, p_classroom_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classroom_enrollments
    WHERE classroom_id = p_classroom_id AND student_id = p_user_id AND dropped_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if a user is an admin of a given organization
CREATE OR REPLACE FUNCTION public.is_org_admin(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = p_user_id AND org_role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Generate a unique 8-character invite code for classrooms
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    SELECT EXISTS (SELECT 1 FROM public.classrooms WHERE invite_code = code) INTO exists;
    IF NOT exists THEN RETURN code; END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Resolve the MAX of personal subscription limits and school contract limits.
-- A student who has both a personal subscription and a school enrollment gets
-- the higher value for each individual limit field.
CREATE OR REPLACE FUNCTION public.get_effective_limits(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  personal_tier TEXT;
  personal_limits JSONB;
  school_config JSONB;
  result JSONB;
BEGIN
  -- Get personal subscription tier
  SELECT COALESCE(s.tier, 'free') INTO personal_tier
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id AND s.is_active = TRUE
  LIMIT 1;

  IF personal_tier IS NULL THEN personal_tier := 'free'; END IF;

  -- Map tier to limits
  personal_limits := CASE personal_tier
    WHEN 'vip' THEN '{"dailyVoiceMinutes":30,"dailyTextMessages":75,"dailyWritingGrades":12,"dailyPronunciationScores":7,"unlimitedHearts":true,"streakShield":true,"audiobookNarration":true}'::jsonb
    WHEN 'premium' THEN '{"dailyVoiceMinutes":20,"dailyTextMessages":50,"dailyWritingGrades":7,"dailyPronunciationScores":5,"unlimitedHearts":true,"streakShield":true,"audiobookNarration":false}'::jsonb
    WHEN 'basic' THEN '{"dailyVoiceMinutes":10,"dailyTextMessages":25,"dailyWritingGrades":3,"dailyPronunciationScores":3,"unlimitedHearts":true,"streakShield":true,"audiobookNarration":false}'::jsonb
    ELSE '{"dailyVoiceMinutes":5,"dailyTextMessages":5,"dailyWritingGrades":1,"dailyPronunciationScores":2,"unlimitedHearts":false,"streakShield":false,"audiobookNarration":false}'::jsonb
  END;

  -- Check for school enrollment with active org
  SELECT o.contract_config INTO school_config
  FROM public.classroom_enrollments ce
  JOIN public.classrooms c ON c.id = ce.classroom_id
  JOIN public.organizations o ON o.id = c.organization_id
  WHERE ce.student_id = p_user_id
    AND ce.dropped_at IS NULL
    AND o.is_active = TRUE
    AND (o.contract_end IS NULL OR o.contract_end >= CURRENT_DATE)
  ORDER BY (o.contract_config->>'dailyVoiceMinutes')::int DESC
  LIMIT 1;

  IF school_config IS NULL THEN
    RETURN personal_limits;
  END IF;

  -- Return MAX of personal and school for each numeric field, OR for booleans
  result := jsonb_build_object(
    'dailyVoiceMinutes', GREATEST(
      (personal_limits->>'dailyVoiceMinutes')::int,
      (school_config->>'dailyVoiceMinutes')::int
    ),
    'dailyTextMessages', GREATEST(
      (personal_limits->>'dailyTextMessages')::int,
      (school_config->>'dailyTextMessages')::int
    ),
    'dailyWritingGrades', GREATEST(
      (personal_limits->>'dailyWritingGrades')::int,
      (school_config->>'dailyWritingGrades')::int
    ),
    'dailyPronunciationScores', GREATEST(
      (personal_limits->>'dailyPronunciationScores')::int,
      (school_config->>'dailyPronunciationScores')::int
    ),
    'unlimitedHearts', (personal_limits->>'unlimitedHearts')::boolean OR (school_config->>'unlimitedHearts')::boolean,
    'streakShield', (personal_limits->>'streakShield')::boolean OR (school_config->>'streakShield')::boolean,
    'audiobookNarration', (personal_limits->>'audiobookNarration')::boolean OR (school_config->>'audiobookNarration')::boolean
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- Section 10: Row Level Security — Enable on all new tables
-- ============================================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Section 11: RLS Policies — user_roles
-- ============================================================================

CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- Section 12: RLS Policies — organizations
-- ============================================================================

CREATE POLICY "Org members can read their organization"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = id AND user_id = auth.uid()
    )
  );

-- ============================================================================
-- Section 13: RLS Policies — organization_members
-- ============================================================================

CREATE POLICY "Users can read own memberships"
  ON public.organization_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Members can read other members in same org"
  ON public.organization_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_id AND om.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Section 14: RLS Policies — classrooms
-- ============================================================================

CREATE POLICY "Teachers can select own classrooms"
  ON public.classrooms FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own classrooms"
  ON public.classrooms FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own classrooms"
  ON public.classrooms FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Enrolled students can read classrooms"
  ON public.classrooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_enrollments
      WHERE classroom_id = id AND student_id = auth.uid() AND dropped_at IS NULL
    )
  );

CREATE POLICY "Org admins can read all classrooms in org"
  ON public.classrooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = classrooms.organization_id
        AND user_id = auth.uid()
        AND org_role = 'admin'
    )
  );

-- ============================================================================
-- Section 15: RLS Policies — classroom_enrollments
-- ============================================================================

CREATE POLICY "Students can read own enrollments"
  ON public.classroom_enrollments FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert own enrollments"
  ON public.classroom_enrollments FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can read enrollments for their classes"
  ON public.classroom_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms
      WHERE id = classroom_id AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update enrollments for their classes"
  ON public.classroom_enrollments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms
      WHERE id = classroom_id AND teacher_id = auth.uid()
    )
  );

-- ============================================================================
-- Section 16: RLS Policies — assignments
-- ============================================================================

CREATE POLICY "Teachers can select own assignments"
  ON public.assignments FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own assignments"
  ON public.assignments FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own assignments"
  ON public.assignments FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own assignments"
  ON public.assignments FOR DELETE
  USING (teacher_id = auth.uid());

CREATE POLICY "Students can read published assignments for enrolled classes"
  ON public.assignments FOR SELECT
  USING (
    status = 'published' AND EXISTS (
      SELECT 1 FROM public.classroom_enrollments
      WHERE classroom_id = assignments.classroom_id
        AND student_id = auth.uid()
        AND dropped_at IS NULL
    )
  );

-- ============================================================================
-- Section 17: RLS Policies — assignment_submissions
-- ============================================================================

CREATE POLICY "Students can select own submissions"
  ON public.assignment_submissions FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert own submissions"
  ON public.assignment_submissions FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own submissions"
  ON public.assignment_submissions FOR UPDATE
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can read submissions for their assignments"
  ON public.assignment_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments
      WHERE id = assignment_id AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update submissions for grading"
  ON public.assignment_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments
      WHERE id = assignment_id AND teacher_id = auth.uid()
    )
  );

-- ============================================================================
-- Section 18: Extended RLS Policies on existing tables (chat_sessions, chat_messages)
-- ============================================================================

CREATE POLICY "Teachers can read assignment chat sessions"
  ON public.chat_sessions FOR SELECT
  USING (
    assignment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = chat_sessions.assignment_id AND a.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can read assignment chat messages"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions cs
      JOIN public.assignments a ON a.id = cs.assignment_id
      WHERE cs.id = chat_messages.session_id AND a.teacher_id = auth.uid()
    )
  );

-- ============================================================================
-- Section 19: Indexes
-- ============================================================================

CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_classrooms_org ON public.classrooms(organization_id);
CREATE INDEX idx_classrooms_teacher ON public.classrooms(teacher_id);
CREATE INDEX idx_classrooms_invite ON public.classrooms(invite_code) WHERE invite_code_active;
CREATE INDEX idx_enrollments_classroom ON public.classroom_enrollments(classroom_id) WHERE dropped_at IS NULL;
CREATE INDEX idx_enrollments_student ON public.classroom_enrollments(student_id) WHERE dropped_at IS NULL;
CREATE INDEX idx_assignments_classroom ON public.assignments(classroom_id);
CREATE INDEX idx_assignments_status ON public.assignments(classroom_id, status) WHERE status = 'published';
CREATE INDEX idx_submissions_assignment ON public.assignment_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON public.assignment_submissions(student_id);
CREATE INDEX idx_chat_sessions_assignment ON public.chat_sessions(assignment_id) WHERE assignment_id IS NOT NULL;
