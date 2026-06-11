-- ═══════════════════════════════════════════════════════════════
-- 035: Schema reconciliation — prod ↔ repo
--
-- Audit (2026-06-10) found the production project was missing schema
-- that the shipped app code already depends on (repo migrations 009,
-- 010, 017, 018, 028, 029, 032, 033, 034 were never applied to prod;
-- prod migration history is timestamp-based and does not track these
-- files). This migration is idempotent and additive-only.
--
-- NOTE: the production Supabase project is SHARED with other apps.
-- Touch only Fluenci objects. Never db reset / db push.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. daily_challenges (from 009) — app queries this table today ──
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  challenges JSONB NOT NULL DEFAULT '[]'::jsonb,
  all_completed BOOLEAN DEFAULT false,
  bonus_xp_claimed BOOLEAN DEFAULT false,
  challenge_streak INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own challenges" ON public.daily_challenges;
CREATE POLICY "Users can read own challenges"
  ON public.daily_challenges FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own challenges" ON public.daily_challenges;
CREATE POLICY "Users can insert own challenges"
  ON public.daily_challenges FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own challenges" ON public.daily_challenges;
CREATE POLICY "Users can update own challenges"
  ON public.daily_challenges FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 2. streak_events (from 010) — app inserts these today ──
CREATE TABLE IF NOT EXISTS public.streak_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('streak_broken', 'streak_repaired', 'shield_activated', 'shield_used', 'freeze_used')),
  streak_at_time INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.streak_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own streak events" ON public.streak_events;
CREATE POLICY "Users can read own streak events"
  ON public.streak_events FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own streak events" ON public.streak_events;
CREATE POLICY "Users can insert own streak events"
  ON public.streak_events FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_streak_events_user ON public.streak_events(user_id, created_at DESC);

-- ── 3. content_sources + grammar_rules (from 017) ──
CREATE TABLE IF NOT EXISTS public.content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  url TEXT,
  license TEXT NOT NULL,
  attribution TEXT,
  description TEXT,
  last_imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "content_sources_read_all" ON public.content_sources;
CREATE POLICY "content_sources_read_all" ON public.content_sources
  FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.grammar_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL,
  cefr_level TEXT NOT NULL CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  rule_name TEXT NOT NULL,
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  examples JSONB NOT NULL DEFAULT '[]',
  common_errors JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  source_id UUID REFERENCES public.content_sources(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(language, rule_name)
);

ALTER TABLE public.grammar_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grammar_rules_read_all" ON public.grammar_rules;
CREATE POLICY "grammar_rules_read_all" ON public.grammar_rules
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_grammar_rules_lang ON public.grammar_rules(language, cefr_level);

-- ── 4. cards: provenance + vocab metadata (017 + 029 chunk type) ──
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS cefr_level TEXT,
  ADD COLUMN IF NOT EXISTS skill_type TEXT DEFAULT 'vocabulary',
  ADD COLUMN IF NOT EXISTS subskill TEXT,
  ADD COLUMN IF NOT EXISTS word_family TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS collocations JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS frequency_rank INT,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'seed',
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.content_sources(id),
  ADD COLUMN IF NOT EXISTS source_item_id TEXT,
  ADD COLUMN IF NOT EXISTS license TEXT;

ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_skill_type_check;
ALTER TABLE public.cards ADD CONSTRAINT cards_skill_type_check
  CHECK (skill_type IN ('vocabulary', 'grammar', 'chunk'));

ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_source_type_check;
ALTER TABLE public.cards ADD CONSTRAINT cards_source_type_check
  CHECK (source_type IN ('imported', 'ai_generated', 'seed', 'manual'));

CREATE INDEX IF NOT EXISTS idx_cards_language_level ON public.cards(language, cefr_level);
CREATE INDEX IF NOT EXISTS idx_cards_source ON public.cards(source_type);
CREATE INDEX IF NOT EXISTS idx_cards_source_dedup ON public.cards(source_id, source_item_id);
-- Covering index for content-scale browsing (language + level + skill)
CREATE INDEX IF NOT EXISTS idx_cards_language_level_skill ON public.cards(language, cefr_level, skill_type);

UPDATE public.cards c SET
  language = co.target_language,
  cefr_level = co.cefr_level
FROM public.courses co
WHERE c.course_id = co.id AND c.language IS NULL;

-- ── 5. exercises: expanded types + skill targeting (017) ──
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_type_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_type_check
  CHECK (type IN (
    'multiple_choice', 'listening_choice', 'listening_type',
    'translate_to_target', 'translate_to_native',
    'speaking', 'fill_blank', 'free_production',
    'cloze_deletion', 'sentence_construction', 'dictation',
    'error_correction',
    'collocation_match', 'word_form',
    'sentence_transformation', 'mini_dialogue'
  ));

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS skill_type TEXT DEFAULT 'vocabulary',
  ADD COLUMN IF NOT EXISTS subskill TEXT,
  ADD COLUMN IF NOT EXISTS response_mode TEXT DEFAULT 'tap',
  ADD COLUMN IF NOT EXISTS target_word TEXT,
  ADD COLUMN IF NOT EXISTS target_grammar TEXT,
  ADD COLUMN IF NOT EXISTS accepted_speech_variants TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS distractors TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'seed',
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.content_sources(id);

ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_skill_type_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_skill_type_check
  CHECK (skill_type IN ('vocabulary', 'grammar', 'mixed'));
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_response_mode_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_response_mode_check
  CHECK (response_mode IN ('tap', 'type', 'speak'));
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_source_type_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_source_type_check
  CHECK (source_type IN ('imported', 'ai_generated', 'seed', 'manual'));

CREATE INDEX IF NOT EXISTS idx_exercises_skill_type ON public.exercises(skill_type);
CREATE INDEX IF NOT EXISTS idx_exercises_response_mode ON public.exercises(response_mode);

INSERT INTO public.content_sources (name, license, description)
VALUES ('fluenci_seed', 'proprietary', 'Auto-generated seed content from generate_seed.py')
ON CONFLICT (name) DO NOTHING;

-- ── 6. daily_usage: per-feature counters (018) ──
-- The deployed 8-arg increment_daily_usage() already references these
-- columns; without them every writing/pronunciation quota call errors.
ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS writing_grades INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pronunciation_scores INTEGER NOT NULL DEFAULT 0;

-- ── 7. user_profiles: motivation (028) + push_token (used by useNotifications) ──
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS motivation_reason TEXT,
  ADD COLUMN IF NOT EXISTS ideal_l2_self TEXT,
  ADD COLUMN IF NOT EXISTS push_token TEXT;

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_ideal_l2_self_len;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_ideal_l2_self_len
  CHECK (ideal_l2_self IS NULL OR char_length(ideal_l2_self) <= 300);

-- ── 8. subscriptions: allow 'starter' tier (032) ──
-- stripe-webhook downgrades cancelled subs to 'starter'; without this
-- the cancellation path violates the CHECK constraint and fails.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('free', 'starter', 'basic', 'premium', 'vip'));

-- ── 9. enrollment insert hardening (033) ──
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

-- ── 10. protect grading columns from student edits (034) ──
CREATE OR REPLACE FUNCTION public.check_student_submission_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS check_student_submission_update_trigger ON public.assignment_submissions;
CREATE TRIGGER check_student_submission_update_trigger
  BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_student_submission_update();
