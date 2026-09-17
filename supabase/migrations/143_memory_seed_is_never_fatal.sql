-- 143 — A memory note must never cost somebody their sign-up.
--
-- Migration 142 put two `upsert_learner_memory` calls inside
-- `apply_onboarding_draft`, which is one transaction. That is the right place
-- for them — the seeds are derived from the row being written, and a seed for a
-- sign-up that did not happen would be worse than no seed — but it left the
-- whole onboarding flush hostage to a derived, disposable row: any error from
-- the memory path (a CHECK this function is not the author of, a future writer
-- that starts raising, a constraint added later) would abort the profile write
-- and strand a learner at the end of onboarding with nothing saved.
--
-- Every other reader and writer of `tutor_memory` already fails soft, on the
-- stated principle that losing a note costs personalisation and never a
-- learning record. This makes the seed obey the same rule: the notes are
-- attempted, and if they cannot be written the profile is still written and the
-- learner still gets into the app.
--
-- Also drops `idx_tutor_memory_user_lang_recent`. Migration 141 added
-- `idx_tutor_memory_user_scope_recent` over the generated `scope_key`, which is
-- what every read now filters on; the old index leads on the nullable
-- `target_language` and no query prefers it. At a million learners the table
-- tops out near 36 rows each, so carrying a second index of that size buys
-- nothing and costs write amplification on every note.

CREATE OR REPLACE FUNCTION public.apply_onboarding_draft(
  p_target_language   text,
  p_level             text,
  p_daily_goal_minutes integer,
  p_ideal_l2_self     text,
  p_display_name      text,
  p_avatar_preset_id  text,
  p_current_course_id uuid,
  p_placement_band    text,
  p_first_lesson      boolean
)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_name       text := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_ideal      text := NULLIF(btrim(COALESCE(p_ideal_l2_self, '')), '');
  v_preset     text := NULLIF(btrim(COALESCE(p_avatar_preset_id, '')), '');
  v_checklist  jsonb;
  v_row        public.user_profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_target_language IS NULL
     OR p_target_language NOT IN ('es','fr','de','it','pt','ja','ko','zh','ru') THEN
    RAISE EXCEPTION 'invalid target_language' USING ERRCODE = '22023';
  END IF;
  IF p_level IS NULL
     OR p_level NOT IN ('beginner','elementary','intermediate','upper_intermediate','advanced') THEN
    RAISE EXCEPTION 'invalid level' USING ERRCODE = '22023';
  END IF;
  IF p_daily_goal_minutes IS NULL OR p_daily_goal_minutes < 1 OR p_daily_goal_minutes > 180 THEN
    RAISE EXCEPTION 'invalid daily_goal_minutes (1-180)' USING ERRCODE = '22023';
  END IF;
  IF v_ideal IS NOT NULL AND char_length(v_ideal) > 300 THEN
    RAISE EXCEPTION 'ideal_l2_self exceeds 300 characters' USING ERRCODE = '22023';
  END IF;
  IF v_name IS NOT NULL AND char_length(v_name) > 24 THEN
    RAISE EXCEPTION 'display_name exceeds 24 characters' USING ERRCODE = '22023';
  END IF;
  IF v_preset IS NOT NULL AND char_length(v_preset) > 64 THEN
    RAISE EXCEPTION 'invalid avatar_preset_id' USING ERRCODE = '22023';
  END IF;
  IF p_placement_band IS NOT NULL
     AND p_placement_band NOT IN ('A1','A2','B1','B2','C1','C2') THEN
    RAISE EXCEPTION 'invalid placement_band' USING ERRCODE = '22023';
  END IF;

  v_checklist := jsonb_build_object(
    'chooseLanguage', true,
    'firstLesson',    COALESCE(p_first_lesson, false),
    'aiConversation', false,
    'dailyReminder',  false,
    'skipped',        '[]'::jsonb,
    'dismissed',      false,
    'completedAt',    NULL,
    'celebratedAt',   NULL
  );

  INSERT INTO public.user_profiles AS up (
    user_id,
    display_name,
    native_language,
    target_language,
    level,
    daily_goal_minutes,
    ideal_l2_self,
    current_course_id,
    placement_band,
    avatar_kind,
    avatar_preset_id,
    onboarding_checklist,
    onboarding_completed,
    updated_at
  )
  VALUES (
    v_uid,
    COALESCE(v_name, ''),
    'en',
    p_target_language,
    p_level,
    p_daily_goal_minutes,
    v_ideal,
    p_current_course_id,
    p_placement_band,
    CASE WHEN v_preset IS NOT NULL THEN 'preset' ELSE 'procedural' END,
    v_preset,
    v_checklist,
    true,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name         = COALESCE(v_name, up.display_name),
    target_language      = EXCLUDED.target_language,
    level                = EXCLUDED.level,
    daily_goal_minutes   = EXCLUDED.daily_goal_minutes,
    ideal_l2_self        = EXCLUDED.ideal_l2_self,
    current_course_id    = EXCLUDED.current_course_id,
    placement_band       = EXCLUDED.placement_band,
    avatar_kind          = CASE WHEN v_preset IS NOT NULL THEN 'preset' ELSE up.avatar_kind END,
    avatar_preset_id     = CASE WHEN v_preset IS NOT NULL THEN v_preset ELSE up.avatar_preset_id END,
    onboarding_checklist = EXCLUDED.onboarding_checklist,
    onboarding_completed = true,
    updated_at           = now()
  RETURNING * INTO v_row;

  -- ── Seed what Sol remembers (142), best-effort (143) ───────────────────
  --
  -- After the profile, never before. Inside its own block, so a failure here
  -- rolls back the two notes and nothing else: these rows are derived and
  -- disposable, and the profile they were derived from is not.
  BEGIN
    IF v_name IS NOT NULL THEN
      PERFORM public.upsert_learner_memory(
        v_uid, p_target_language, 'personal_fact',
        'Their name is ' || v_name || '.',
        'onboarding'
      );
    END IF;

    IF v_ideal IS NOT NULL THEN
      PERFORM public.upsert_learner_memory(
        v_uid, p_target_language, 'goal',
        'What they pictured being able to do: ' || left(v_ideal, 160),
        'onboarding'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Logged rather than swallowed silently: a seed that stops working should
    -- be visible in the Postgres log as a warning, not inferred months later
    -- from an empty memory screen.
    RAISE WARNING 'tutor_memory seed skipped for %: % (%)', v_uid, SQLERRM, SQLSTATE;
  END;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_onboarding_draft(text, text, integer, text, text, text, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_onboarding_draft(text, text, integer, text, text, text, uuid, text, boolean) TO authenticated;

DROP INDEX IF EXISTS public.idx_tutor_memory_user_lang_recent;
