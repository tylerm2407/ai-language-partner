-- 127 — apply_onboarding_draft(): the whole post-sign-up profile write in one
-- guarded, idempotent RPC.
--
-- WHY — the client used to flush the onboarding draft as six sequential
-- round trips (profile upsert, avatar kind, checklist, onboarding_completed,
-- then two local writes). Nothing made them atomic. A dropped connection after
-- the upsert left a profile with a language and level but
-- onboarding_completed = false, so the route guard sent the learner back into
-- onboarding with the draft already cleared on some paths. At launch scale
-- that partial state is the normal case, not the edge case.
--
-- WHAT — one SECURITY DEFINER function, caller-guarded on auth.uid(), that
-- upserts every server-side fact of the draft in a single statement. The row
-- is either fully written or untouched, and calling it twice with the same
-- input leaves the same row, so the client can retry freely.
--
-- WHAT IT DOES NOT DO — resolve the course. `defaultCourseFor` in
-- `lib/course-placement.ts` is the single source of truth for how a declared
-- level and a placement choice become a course; the client reads the courses
-- (a cached, side-effect-free read) and passes the resolved pointer and band.
-- `fluenci_guard_current_course` (migration 125) still validates the pointer
-- against the language on the same row, so a forged id cannot land.
--
-- The gamification guard (036, rewritten in 084) still fires: auth.uid() is
-- the caller's inside a SECURITY DEFINER function, the INSERT branch resets
-- total_xp / xp_level / league_tier / free_avatar_used_at to their defaults,
-- and the UPDATE branch never sees them change because this function does
-- not touch them.

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

  -- Input validation at the boundary. The CHECK constraints would catch most
  -- of these too, but a named error is what the client's retry copy needs.
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

  -- The checklist the client wrote wholesale before; same shape, same values.
  -- `firstLesson` is true when the bundled trial ran: it happened before this
  -- account existed, so nothing server-side recorded it, and re-asking the
  -- learner to "complete your first lesson" would deny work they just did.
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
    -- An empty name in the draft keeps whatever the row already has (a name
    -- set on an earlier, abandoned pass); a non-empty one replaces it.
    display_name         = COALESCE(v_name, up.display_name),
    target_language      = EXCLUDED.target_language,
    level                = EXCLUDED.level,
    daily_goal_minutes   = EXCLUDED.daily_goal_minutes,
    ideal_l2_self        = EXCLUDED.ideal_l2_self,
    current_course_id    = EXCLUDED.current_course_id,
    placement_band       = EXCLUDED.placement_band,
    -- A draft with no preset leaves the avatar alone: the learner may already
    -- hold a generated photo avatar from an earlier session.
    avatar_kind          = CASE WHEN v_preset IS NOT NULL THEN 'preset' ELSE up.avatar_kind END,
    avatar_preset_id     = CASE WHEN v_preset IS NOT NULL THEN v_preset ELSE up.avatar_preset_id END,
    onboarding_checklist = EXCLUDED.onboarding_checklist,
    onboarding_completed = true,
    updated_at           = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_onboarding_draft(text, text, integer, text, text, text, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_onboarding_draft(text, text, integer, text, text, text, uuid, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.apply_onboarding_draft(text, text, integer, text, text, text, uuid, text, boolean) IS
  'Atomic, idempotent flush of the onboarding draft into the caller''s user_profiles row. Replaces the six-call client chain; see migration 127.';
