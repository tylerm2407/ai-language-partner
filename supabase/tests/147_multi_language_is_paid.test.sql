-- Behavioural test for migration 147, run INSIDE a transaction that is rolled
-- back: `BEGIN; <migration 147>; <this file>; ROLLBACK;` against a copy of
-- the schema (or production, where nothing survives the ROLLBACK).
--
-- Fabricated auth.users rows (ids under 00000000-0000-4147-…) are created and
-- vanish with the rollback. The final SELECT lists every case with its
-- expected and actual SQLSTATE ('ok' = no error); `pass` must be true on all.

CREATE TEMP TABLE results (name text, expected text, actual text, pass boolean);

-- Run `p_sql` as learner `p_uid`. `p_rls` also drops to the authenticated
-- role, so RLS and grants apply exactly as they do for a PostgREST request.
CREATE FUNCTION pg_temp.t(p_name text, p_uid uuid, p_sql text, p_expect text, p_rls boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_state text := 'ok'; v_n bigint;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  IF p_rls THEN EXECUTE 'SET LOCAL ROLE authenticated'; END IF;
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF p_expect = 'zero-rows' THEN v_state := CASE WHEN v_n = 0 THEN 'zero-rows' ELSE 'rows:' || v_n END; END IF;
  EXCEPTION WHEN OTHERS THEN
    -- The message rides along so a failing case says why; a match on the
    -- expected SQLSTATE alone counts as a pass.
    v_state := SQLSTATE || ' ' || left(SQLERRM, 80);
    IF split_part(v_state, ' ', 1) = p_expect THEN v_state := p_expect; END IF;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO results VALUES (p_name, p_expect, v_state, v_state = p_expect);
END $$;

CREATE FUNCTION pg_temp.check(p_name text, p_ok boolean, p_detail text DEFAULT '')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO results VALUES (p_name, 'true', COALESCE(p_ok::text, 'null') || CASE WHEN p_detail <> '' THEN ' ' || p_detail ELSE '' END, COALESCE(p_ok, false));
END $$;

CREATE FUNCTION pg_temp.langs(p_uid uuid, p_locked boolean)
RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(language, ',' ORDER BY language), '')
    FROM public.user_language_enrollments
   WHERE user_id = p_uid AND (locked_at IS NOT NULL) = p_locked;
$$;

CREATE FUNCTION pg_temp.active(p_uid uuid)
RETURNS text LANGUAGE sql AS $$ SELECT target_language FROM public.user_profiles WHERE user_id = p_uid $$;

INSERT INTO auth.users (id, email, aud, role, created_at, updated_at) VALUES
  ('00000000-0000-4147-0000-000000000001', 'mlp-free@test.invalid',   'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-4147-0000-000000000002', 'mlp-onboard@test.invalid','authenticated', 'authenticated', now(), now()),
  ('00000000-0000-4147-0000-000000000003', 'mlp-race@test.invalid',   'authenticated', 'authenticated', now(), now());

DO $$
DECLARE
  u1 uuid := '00000000-0000-4147-0000-000000000001';
  u2 uuid := '00000000-0000-4147-0000-000000000002';
  u3 uuid := '00000000-0000-4147-0000-000000000003';
  onboard text := $q$SELECT public.apply_onboarding_draft('%s','beginner',10,NULL,'T',NULL,NULL,NULL,false)$q$;
BEGIN
  -- ── Free learner ──────────────────────────────────────────────────────────
  PERFORM pg_temp.t('free: onboarding into es', u1, format(onboard, 'es'), 'ok', true);
  PERFORM pg_temp.check('free: es enrollment open', pg_temp.langs(u1, false) = 'es', pg_temp.langs(u1, false));
  PERFORM pg_temp.check('limits: free maxLanguages = 1', (public.get_effective_limits(u1)->>'maxLanguages')::int = 1);

  PERFORM pg_temp.t('free: add fr without lock → FLL01', u1,
    $q$SELECT public.switch_target_language('fr','beginner')$q$, 'FLL01', true);
  PERFORM pg_temp.t('free: raw PATCH target_language=fr → FLL01', u1,
    $q$UPDATE public.user_profiles SET target_language='fr' WHERE user_id = auth.uid()$q$, 'FLL01', true);
  PERFORM pg_temp.t('free: upsert naming fr → FLL01', u1,
    $q$INSERT INTO public.user_profiles (user_id, target_language) VALUES (auth.uid(), 'fr')
       ON CONFLICT (user_id) DO UPDATE SET target_language = EXCLUDED.target_language$q$, 'FLL01', true);
  PERFORM pg_temp.t('free: re-running onboarding with fr → FLL01', u1, format(onboard, 'fr'), 'FLL01', true);
  PERFORM pg_temp.check('free: still es only after refusals', pg_temp.active(u1) = 'es' AND pg_temp.langs(u1, false) = 'es' AND pg_temp.langs(u1, true) = '');

  PERFORM pg_temp.t('free: timezone upsert (column default es) still works', u1,
    $q$INSERT INTO public.user_profiles (user_id, timezone) VALUES (auth.uid(), 'Europe/Paris')
       ON CONFLICT (user_id) DO UPDATE SET timezone = EXCLUDED.timezone$q$, 'ok', true);
  PERFORM pg_temp.t('free: re-place active language (Settings level change)', u1,
    $q$SELECT public.switch_target_language('es','elementary')$q$, 'ok', true);

  PERFORM pg_temp.t('free: lock-and-switch to fr', u1,
    $q$SELECT public.switch_target_language('fr','beginner',NULL,NULL,true)$q$, 'ok', true);
  PERFORM pg_temp.check('free: fr active, es locked', pg_temp.active(u1) = 'fr' AND pg_temp.langs(u1, false) = 'fr' AND pg_temp.langs(u1, true) = 'es',
    pg_temp.active(u1) || ' open=' || pg_temp.langs(u1, false) || ' locked=' || pg_temp.langs(u1, true));
  PERFORM pg_temp.check('free: es level kept while locked',
    (SELECT level FROM public.user_language_enrollments WHERE user_id = u1 AND language = 'es') = 'elementary');

  PERFORM pg_temp.t('free: switch back to locked es → FLL02', u1,
    $q$SELECT public.switch_target_language('es')$q$, 'FLL02', true);
  PERFORM pg_temp.t('free: lock-and-switch back to locked es → FLL02', u1,
    $q$SELECT public.switch_target_language('es',NULL,NULL,NULL,true)$q$, 'FLL02', true);
  PERFORM pg_temp.t('free: re-level locked es → FLL02', u1,
    $q$SELECT public.switch_target_language('es','beginner',NULL,NULL,true)$q$, 'FLL02', true);
  PERFORM pg_temp.t('free: raw PATCH to locked es → FLL02', u1,
    $q$UPDATE public.user_profiles SET target_language='es' WHERE user_id = auth.uid()$q$, 'FLL02', true);
  PERFORM pg_temp.t('free: keep_languages([es]) cannot reopen → FLL02', u1,
    $q$SELECT public.keep_languages(ARRAY['es'])$q$, 'FLL02', true);
  PERFORM pg_temp.t('free: keep_languages([fr,es]) → FLL01', u1,
    $q$SELECT public.keep_languages(ARRAY['fr','es'])$q$, 'FLL01', true);
  PERFORM pg_temp.t('free: clear locked_at directly → 0 rows or denied', u1,
    $q$UPDATE public.user_language_enrollments SET locked_at = NULL WHERE user_id = auth.uid()$q$, 'zero-rows', true);
  PERFORM pg_temp.t('free: insert an enrollment directly → denied', u1,
    $q$INSERT INTO public.user_language_enrollments (user_id, language, level) VALUES (auth.uid(), 'de', 'beginner')$q$, '42501', true);
  PERFORM pg_temp.t('free: reset onboarding_completed → 42501', u1,
    $q$UPDATE public.user_profiles SET onboarding_completed = false WHERE user_id = auth.uid()$q$, '42501', true);
  PERFORM pg_temp.check('free: es still locked after every attempt', pg_temp.langs(u1, true) = 'es' AND pg_temp.active(u1) = 'fr');

  PERFORM pg_temp.t('free: get_language_access', u1, $q$SELECT public.get_language_access()$q$, 'ok', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  PERFORM pg_temp.check('free: access = max 1, open [fr], locked [es], not over',
    public.get_language_access() = '{"maxLanguages":1,"open":["fr"],"locked":["es"],"overLimit":false}'::jsonb,
    public.get_language_access()::text);
  PERFORM set_config('request.jwt.claims', '', true);

  PERFORM pg_temp.t('anon: switch_target_language not executable', u1,
    $q$SET LOCAL ROLE anon; SELECT public.switch_target_language('fr')$q$, '42501');
  PERFORM pg_temp.t('authenticated: internal helper not executable', u1,
    $q$SELECT public.fluenci_assert_language_capacity(auth.uid(), 'de')$q$, '42501', true);

  -- ── Upgrade ───────────────────────────────────────────────────────────────
  INSERT INTO public.subscriptions (user_id, tier, is_active, subscription_status, current_period_end)
  VALUES (u1, 'premium', true, 'active', now() + interval '30 days');
  PERFORM pg_temp.check('limits: premium maxLanguages = 9999', (public.get_effective_limits(u1)->>'maxLanguages')::int = 9999);
  PERFORM pg_temp.t('paid: reopen locked es', u1, $q$SELECT public.switch_target_language('es')$q$, 'ok', true);
  PERFORM pg_temp.check('paid: es kept its level on reopen',
    (SELECT level FROM public.user_profiles WHERE user_id = u1) = 'elementary');
  PERFORM pg_temp.t('paid: add de without lock', u1, $q$SELECT public.switch_target_language('de','beginner')$q$, 'ok', true);
  PERFORM pg_temp.t('paid: switch es', u1, $q$SELECT public.switch_target_language('es')$q$, 'ok', true);
  PERFORM pg_temp.check('paid: three open, none locked', pg_temp.langs(u1, false) = 'de,es,fr' AND pg_temp.langs(u1, true) = '');

  -- ── Lapse ─────────────────────────────────────────────────────────────────
  UPDATE public.subscriptions SET is_active = false, subscription_status = 'expired' WHERE user_id = u1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  PERFORM pg_temp.check('lapsed: overLimit', (public.get_language_access()->>'overLimit')::boolean, public.get_language_access()::text);
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM pg_temp.t('lapsed: switch to another open language → FLL03', u1,
    $q$SELECT public.switch_target_language('fr')$q$, 'FLL03', true);
  PERFORM pg_temp.t('lapsed: add a new language → FLL01', u1,
    $q$SELECT public.switch_target_language('it','beginner')$q$, 'FLL01', true);
  PERFORM pg_temp.t('lapsed: re-place the active language still works', u1,
    $q$SELECT public.switch_target_language('es','intermediate')$q$, 'ok', true);
  PERFORM pg_temp.t('lapsed: keep two on a plan of one → FLL01', u1,
    $q$SELECT public.keep_languages(ARRAY['fr','de'])$q$, 'FLL01', true);
  PERFORM pg_temp.t('lapsed: keep bad input → 22023', u1,
    $q$SELECT public.keep_languages(ARRAY['fr','fr'])$q$, '22023', true);
  PERFORM pg_temp.t('lapsed: keep empty → 22023', u1,
    $q$SELECT public.keep_languages(ARRAY[]::text[])$q$, '22023', true);
  PERFORM pg_temp.t('lapsed: keep [fr] (not the active one)', u1,
    $q$SELECT public.keep_languages(ARRAY['fr'])$q$, 'ok', true);
  PERFORM pg_temp.check('lapsed: fr active and only open; es,de locked',
    pg_temp.active(u1) = 'fr' AND pg_temp.langs(u1, false) = 'fr' AND pg_temp.langs(u1, true) = 'de,es',
    pg_temp.active(u1) || ' open=' || pg_temp.langs(u1, false) || ' locked=' || pg_temp.langs(u1, true));
  PERFORM pg_temp.check('lapsed: es kept intermediate while locked',
    (SELECT level FROM public.user_language_enrollments WHERE user_id = u1 AND language = 'es') = 'intermediate');

  -- ── Pre-onboarding placeholder ────────────────────────────────────────────
  PERFORM pg_temp.t('onboard: profile created early by timezone upsert (default es)', u2,
    $q$INSERT INTO public.user_profiles (user_id, timezone) VALUES (auth.uid(), 'UTC')
       ON CONFLICT (user_id) DO UPDATE SET timezone = EXCLUDED.timezone$q$, 'ok', true);
  PERFORM pg_temp.check('onboard: placeholder es enrollment exists', pg_temp.langs(u2, false) = 'es', pg_temp.langs(u2, false));
  PERFORM pg_temp.t('onboard: choosing fr as the first language', u2, format(onboard, 'fr'), 'ok', true);
  PERFORM pg_temp.check('onboard: fr only, placeholder gone (not locked)',
    pg_temp.langs(u2, false) = 'fr' AND pg_temp.langs(u2, true) = '',
    'open=' || pg_temp.langs(u2, false) || ' locked=' || pg_temp.langs(u2, true));
  PERFORM pg_temp.t('onboard: second onboarding run with es → FLL01', u2, format(onboard, 'es'), 'FLL01', true);

  -- ── Trusted operators are not gated ───────────────────────────────────────
  PERFORM pg_temp.t('free, first lang for u3', u3, format(onboard, 'ja'), 'ok', true);
  UPDATE public.user_profiles SET target_language = 'ko' WHERE user_id = u3;  -- no JWT: operator session
  PERFORM pg_temp.check('operator: service/DB session may move a learner', pg_temp.active(u3) = 'ko');
  PERFORM pg_temp.check('operator: active language is open', pg_temp.langs(u3, false) LIKE '%ko%');
END $$;

SELECT name, expected, actual, pass FROM results ORDER BY pass, name;
