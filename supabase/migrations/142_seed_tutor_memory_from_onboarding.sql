-- 142 — Sol starts the first session already knowing something.
--
-- `apply_onboarding_draft` (migration 127) is the one atomic write that turns a
-- finished onboarding into a profile. Two of the answers it already stores are
-- exactly the kind of thing the tutor's memory exists to hold, and until now
-- they reached the tutor only through `learner-context.ts`, which is paid-only
-- and invisible to the learner:
--
--   * `display_name`   → a `personal_fact`, account-wide. A tutor that cannot
--                        greet you by name is not remembering anything.
--   * `ideal_l2_self`  → a `goal`, per-language. The learner wrote it in their
--                        own words at sign-up; it is the single best statement
--                        of what they want the sessions to be for.
--
-- WHY IT MATTERS MORE THAN IT LOOKS: "What Sol remembers" was empty for every
-- learner on the planet, because the only writer was the end-of-session
-- summariser of a live voice session. A feature whose whole promise is "this is
-- what the tutor knows about you, and you can change it" cannot open on an
-- empty page and be believed. Seeding costs no LLM call and no new answer from
-- the learner — the facts are already in the row this function writes.
--
-- The notes are written with `source = 'onboarding'`, so the screen can say
-- where they came from, and the learner can delete or rewrite either of them
-- like any other note. Deleting them costs personalisation and nothing else;
-- `user_profiles` remains the record of fact.
--
-- Seeding is best-effort by construction: it runs after the profile write in
-- the same transaction, and both seeds are idempotent (the dedupe key is the
-- content), so the retry the client is allowed to make produces the same two
-- rows rather than four.

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

  -- ── Seed what Sol remembers (migration 142) ────────────────────────────
  --
  -- After the profile, never before: the seeds are derived from it, and a
  -- failure in the profile write must leave no memory of a sign-up that did
  -- not happen. `upsert_learner_memory` resolves the scope itself, so the name
  -- lands account-wide and the goal lands on this language.
  IF v_name IS NOT NULL THEN
    PERFORM public.upsert_learner_memory(
      v_uid, p_target_language, 'personal_fact',
      'Their name is ' || v_name || '.',
      'onboarding'
    );
  END IF;

  IF v_ideal IS NOT NULL THEN
    -- Truncated to leave room for the frame, rather than letting the RPC's
    -- `left(…, 200)` cut the frame off and keep the tail.
    PERFORM public.upsert_learner_memory(
      v_uid, p_target_language, 'goal',
      'What they pictured being able to do: ' || left(v_ideal, 160),
      'onboarding'
    );
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_onboarding_draft(text, text, integer, text, text, text, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_onboarding_draft(text, text, integer, text, text, text, uuid, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.apply_onboarding_draft(text, text, integer, text, text, text, uuid, text, boolean) IS
  'Atomic, idempotent flush of the onboarding draft into the caller''s user_profiles row, plus the two tutor_memory seeds derived from it (migrations 127, 142).';
