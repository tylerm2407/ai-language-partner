-- ═══════════════════════════════════════════════════════════════
-- 037: Atomic quota consumption + safe user-by-email lookup
--
-- 1) consume_daily_quota() replaces the read-check-increment pattern in
--    edge functions (ai-chat, grade-writing, score-pronunciation,
--    generate-story). The old pattern let N concurrent requests all pass
--    the limit check before any increment landed. This function checks
--    and increments in one statement under a row lock — race-free.
--
-- 2) get_user_id_by_email() replaces auth.admin.listUsers({ filter })
--    in school bulkEnroll. supabase-js ignores the unsupported `filter`
--    option, so the lookup returned the first page of ALL users and the
--    code enrolled users[0] — an arbitrary user — into the classroom.
--
-- Both are service-role only.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.consume_daily_quota(
  p_user_id uuid,
  p_counter text,
  p_limit integer,
  p_amount integer DEFAULT 1
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated') THEN
    RAISE EXCEPTION 'invalid quota counter: %', p_counter USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'invalid quota amount' USING ERRCODE = '22023';
  END IF;
  -- Negative limit means unlimited (still record usage for analytics).
  IF p_limit IS NULL OR p_limit < 0 THEN
    INSERT INTO public.daily_usage (user_id, date)
    VALUES (p_user_id, CURRENT_DATE)
    ON CONFLICT (user_id, date) DO NOTHING;
    EXECUTE format(
      'UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $2 WHERE user_id = $1 AND date = CURRENT_DATE',
      p_counter
    ) USING p_user_id, p_amount;
    RETURN true;
  END IF;

  INSERT INTO public.daily_usage (user_id, date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, date) DO NOTHING;

  -- Atomic check-and-increment: the row lock serializes concurrent calls,
  -- and the WHERE clause refuses the increment once the limit is reached.
  EXECUTE format(
    'UPDATE public.daily_usage SET %1$I = COALESCE(%1$I, 0) + $3
      WHERE user_id = $1 AND date = CURRENT_DATE AND COALESCE(%1$I, 0) + $3 <= $2
      RETURNING true',
    p_counter
  ) USING p_user_id, p_limit, p_amount INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_daily_quota(uuid, text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;
