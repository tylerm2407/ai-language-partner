-- ═══════════════════════════════════════════════════════════════
-- 036: Gamification lockdown — server-authoritative XP / hearts / streaks
--
-- Before this migration any user could set their own total_xp, hearts,
-- streak, league_tier, etc. to arbitrary values with a direct PostgREST
-- UPDATE (the user_profiles RLS policy allows unrestricted self-update),
-- and prod's increment_xp() had NO caller guard (any user could grant
-- XP to ANY user). Hearts gate free-tier usage, so this was also a
-- monetization bypass.
--
-- Design:
--  • A BEFORE INSERT/UPDATE trigger blocks client writes to gamification
--    columns (permissive RLS policies OR together, so policy changes
--    alone cannot enforce this — and user_profiles is shared with
--    another app whose policies must not be touched).
--  • Guarded SECURITY DEFINER RPCs are the only client write path. They
--    set a transaction-local GUC the trigger recognizes.
--  • Hearts regen and level/league derivation move server-side
--    (mirrors lib/hearts.ts 4h regen and lib/levels.ts anchor curve).
--  • Streaks derive from daily_stats activity, +1 max per calendar day.
--  • increment_daily_usage becomes service-role-only (quota integrity).
-- ═══════════════════════════════════════════════════════════════

-- ── 0. Streak bookkeeping column ──
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS streak_updated_on DATE;

-- ── 1. Level curve (mirrors lib/levels.ts anchors) ──
CREATE OR REPLACE FUNCTION public.fluenci_level_for_xp(p_xp integer)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  WITH anchors(lvl, xp) AS (
    VALUES (1,0),(2,100),(5,700),(10,2500),(25,15000),(50,75000),(100,500000)
  ),
  thresholds AS (
    SELECT g.lvl,
           CASE WHEN a2.lvl = a1.lvl THEN a1.xp
                ELSE round(a1.xp + (g.lvl - a1.lvl)::numeric * (a2.xp - a1.xp) / (a2.lvl - a1.lvl))::int
           END AS threshold
    FROM generate_series(1,100) AS g(lvl)
    CROSS JOIN LATERAL (SELECT * FROM anchors a WHERE a.lvl <= g.lvl ORDER BY a.lvl DESC LIMIT 1) a1
    CROSS JOIN LATERAL (SELECT * FROM anchors a WHERE a.lvl >= g.lvl ORDER BY a.lvl ASC LIMIT 1) a2
  )
  SELECT COALESCE(max(lvl), 1) FROM thresholds WHERE threshold <= GREATEST(p_xp, 0)
$$;

CREATE OR REPLACE FUNCTION public.fluenci_league_for_level(p_level integer)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_level >= 76 THEN 'diamond'
    WHEN p_level >= 51 THEN 'platinum'
    WHEN p_level >= 26 THEN 'gold'
    WHEN p_level >= 11 THEN 'silver'
    ELSE 'bronze'
  END
$$;

-- ── 2. Guard trigger ──
CREATE OR REPLACE FUNCTION public.fluenci_guard_gamification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Service role / direct SQL (no JWT) bypasses; so do our RPCs via GUC.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(current_setting('fluenci.gamification_write', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- New profiles start at the canonical defaults regardless of payload.
    NEW.total_xp := 0;
    NEW.xp_level := 1;
    NEW.league_tier := 'bronze';
    NEW.hearts := 5;
    NEW.max_hearts := 5;
    NEW.last_heart_lost_at := NULL;
    NEW.streak := 0;
    NEW.longest_streak := 0;
    NEW.streak_freezes := LEAST(GREATEST(COALESCE(NEW.streak_freezes, 0), 0), 2);
    NEW.streak_shield_active := false;
    NEW.streak_shield_used_at := NULL;
    NEW.streak_updated_on := NULL;
    RETURN NEW;
  END IF;

  IF NEW.total_xp            IS DISTINCT FROM OLD.total_xp
     OR NEW.xp_level         IS DISTINCT FROM OLD.xp_level
     OR NEW.hearts           IS DISTINCT FROM OLD.hearts
     OR NEW.max_hearts       IS DISTINCT FROM OLD.max_hearts
     OR NEW.last_heart_lost_at IS DISTINCT FROM OLD.last_heart_lost_at
     OR NEW.streak           IS DISTINCT FROM OLD.streak
     OR NEW.longest_streak   IS DISTINCT FROM OLD.longest_streak
     OR NEW.streak_freezes   IS DISTINCT FROM OLD.streak_freezes
     OR NEW.league_tier      IS DISTINCT FROM OLD.league_tier
     OR NEW.streak_shield_active  IS DISTINCT FROM OLD.streak_shield_active
     OR NEW.streak_shield_used_at IS DISTINCT FROM OLD.streak_shield_used_at
     OR NEW.streak_updated_on     IS DISTINCT FROM OLD.streak_updated_on
  THEN
    RAISE EXCEPTION 'gamification columns are server-managed; use the RPCs (increment_xp, spend_heart, sync_hearts, update_streak, repair_streak_with_freeze, repair_streak_with_shield)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fluenci_guard_gamification_trigger ON public.user_profiles;
CREATE TRIGGER fluenci_guard_gamification_trigger
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fluenci_guard_gamification();

-- ── 3. increment_xp — caller guard + per-call cap + level derivation ──
CREATE OR REPLACE FUNCTION public.increment_xp(p_user_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_new_xp INT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'forbidden: cannot modify another user''s XP' USING ERRCODE = '42501';
    END IF;
    IF p_amount IS NULL OR p_amount < 1 OR p_amount > 500 THEN
      RAISE EXCEPTION 'invalid XP amount (1-500)' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM set_config('fluenci.gamification_write', '1', true);

  UPDATE public.user_profiles
     SET total_xp    = total_xp + p_amount,
         xp_level    = public.fluenci_level_for_xp(total_xp + p_amount),
         league_tier = public.fluenci_league_for_level(public.fluenci_level_for_xp(total_xp + p_amount)),
         updated_at  = now()
   WHERE user_id = p_user_id
   RETURNING total_xp INTO v_new_xp;

  RETURN COALESCE(v_new_xp, 0);
END;
$$;

-- ── 4. Hearts: server-side regen (1 per 4h, mirrors lib/hearts.ts) ──
CREATE OR REPLACE FUNCTION public.sync_hearts()
RETURNS TABLE(hearts integer, max_hearts integer, last_heart_lost_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
  v_regen int;
  v_new int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('fluenci.gamification_write', '1', true);

  SELECT p.hearts, p.max_hearts, p.last_heart_lost_at
    INTO v_row
    FROM public.user_profiles p
   WHERE p.user_id = v_uid
   FOR UPDATE;

  IF FOUND AND v_row.last_heart_lost_at IS NOT NULL AND v_row.hearts < v_row.max_hearts THEN
    v_regen := FLOOR(EXTRACT(EPOCH FROM (now() - v_row.last_heart_lost_at)) / 14400)::int;
    IF v_regen > 0 THEN
      v_new := LEAST(v_row.hearts + v_regen, v_row.max_hearts);
      UPDATE public.user_profiles p
         SET hearts = v_new,
             last_heart_lost_at = CASE WHEN v_new >= p.max_hearts THEN NULL
                                       ELSE p.last_heart_lost_at + make_interval(secs => v_regen * 14400) END,
             updated_at = now()
       WHERE p.user_id = v_uid;
    END IF;
  END IF;

  RETURN QUERY
    SELECT p.hearts, p.max_hearts, p.last_heart_lost_at
      FROM public.user_profiles p WHERE p.user_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_heart()
RETURNS TABLE(hearts integer, max_hearts integer, last_heart_lost_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
  v_regen int := 0;
  v_current int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('fluenci.gamification_write', '1', true);

  SELECT p.hearts, p.max_hearts, p.last_heart_lost_at
    INTO v_row
    FROM public.user_profiles p
   WHERE p.user_id = v_uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Apply pending regen before spending so we never under-count.
  IF v_row.last_heart_lost_at IS NOT NULL AND v_row.hearts < v_row.max_hearts THEN
    v_regen := GREATEST(FLOOR(EXTRACT(EPOCH FROM (now() - v_row.last_heart_lost_at)) / 14400)::int, 0);
  END IF;
  v_current := LEAST(v_row.hearts + v_regen, v_row.max_hearts);

  UPDATE public.user_profiles p
     SET hearts = GREATEST(v_current - 1, 0),
         last_heart_lost_at = now(),
         updated_at = now()
   WHERE p.user_id = v_uid;

  RETURN QUERY
    SELECT p.hearts, p.max_hearts, p.last_heart_lost_at
      FROM public.user_profiles p WHERE p.user_id = v_uid;
END;
$$;

-- ── 5. Streaks: derived from daily_stats, max +1 per calendar day ──
CREATE OR REPLACE FUNCTION public.update_streak()
RETURNS TABLE(streak integer, longest_streak integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
  v_active boolean;
  v_new int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('fluenci.gamification_write', '1', true);

  SELECT p.streak, p.longest_streak, p.streak_updated_on
    INTO v_row
    FROM public.user_profiles p
   WHERE p.user_id = v_uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.daily_stats d
     WHERE d.user_id = v_uid AND d.date = CURRENT_DATE
       AND (d.lessons_completed > 0 OR d.cards_reviewed > 0 OR d.passages_read > 0
            OR d.words_written > 0 OR d.minutes_practiced > 0 OR d.xp_earned > 0)
  ) INTO v_active;

  -- Idempotent per day; no activity today → no change.
  IF NOT v_active OR v_row.streak_updated_on = CURRENT_DATE THEN
    RETURN QUERY SELECT p.streak, p.longest_streak FROM public.user_profiles p WHERE p.user_id = v_uid;
    RETURN;
  END IF;

  IF v_row.streak_updated_on = CURRENT_DATE - 1 THEN
    v_new := v_row.streak + 1;
  ELSE
    -- No marker from yesterday: derive consecutive active days ending today.
    SELECT count(*)::int INTO v_new FROM (
      SELECT d.date, row_number() OVER (ORDER BY d.date DESC) AS rn
        FROM public.daily_stats d
       WHERE d.user_id = v_uid AND d.date <= CURRENT_DATE
         AND (d.lessons_completed > 0 OR d.cards_reviewed > 0 OR d.passages_read > 0
              OR d.words_written > 0 OR d.minutes_practiced > 0 OR d.xp_earned > 0)
    ) t
    WHERE t.date = CURRENT_DATE - (t.rn - 1);
    v_new := GREATEST(v_new, 1);
  END IF;

  UPDATE public.user_profiles p
     SET streak = v_new,
         longest_streak = GREATEST(p.longest_streak, v_new),
         streak_updated_on = CURRENT_DATE,
         updated_at = now()
   WHERE p.user_id = v_uid;

  RETURN QUERY SELECT p.streak, p.longest_streak FROM public.user_profiles p WHERE p.user_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_streak_with_freeze()
RETURNS TABLE(streak integer, longest_streak integer, streak_freezes integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
  v_restored int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('fluenci.gamification_write', '1', true);

  SELECT p.streak_freezes, p.longest_streak
    INTO v_row
    FROM public.user_profiles p
   WHERE p.user_id = v_uid
   FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_row.streak_freezes, 0) <= 0 THEN
    RAISE EXCEPTION 'no streak freezes available' USING ERRCODE = '22023';
  END IF;

  v_restored := GREATEST(v_row.longest_streak, 1);

  UPDATE public.user_profiles p
     SET streak_freezes = p.streak_freezes - 1,
         streak = v_restored,
         streak_updated_on = CURRENT_DATE - 1,
         updated_at = now()
   WHERE p.user_id = v_uid;

  INSERT INTO public.streak_events (user_id, event_type, streak_at_time)
  VALUES (v_uid, 'freeze_used', v_restored);

  RETURN QUERY
    SELECT p.streak, p.longest_streak, p.streak_freezes
      FROM public.user_profiles p WHERE p.user_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_streak_with_shield()
RETURNS TABLE(streak integer, longest_streak integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tier text;
  v_row record;
  v_restored int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('fluenci.gamification_write', '1', true);

  SELECT s.tier INTO v_tier
    FROM public.subscriptions s
   WHERE s.user_id = v_uid AND s.is_active = true;

  IF v_tier IS NULL OR v_tier NOT IN ('basic', 'premium', 'vip') THEN
    RAISE EXCEPTION 'streak shield requires a paid plan' USING ERRCODE = '42501';
  END IF;

  SELECT p.longest_streak, p.streak_shield_used_at
    INTO v_row
    FROM public.user_profiles p
   WHERE p.user_id = v_uid
   FOR UPDATE;

  IF NOT FOUND OR v_row.streak_shield_used_at IS NOT NULL THEN
    RAISE EXCEPTION 'streak shield already used' USING ERRCODE = '22023';
  END IF;

  v_restored := GREATEST(v_row.longest_streak, 1);

  UPDATE public.user_profiles p
     SET streak = v_restored,
         streak_shield_active = true,
         streak_shield_used_at = CURRENT_DATE,
         streak_updated_on = CURRENT_DATE - 1,
         updated_at = now()
   WHERE p.user_id = v_uid;

  INSERT INTO public.streak_events (user_id, event_type, streak_at_time)
  VALUES (v_uid, 'shield_used', v_restored);

  RETURN QUERY
    SELECT p.streak, p.longest_streak FROM public.user_profiles p WHERE p.user_id = v_uid;
END;
$$;

-- ── 6. Grants ──
REVOKE ALL ON FUNCTION public.increment_xp(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_xp(uuid, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sync_hearts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_hearts() TO authenticated;

REVOKE ALL ON FUNCTION public.spend_heart() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_heart() TO authenticated;

REVOKE ALL ON FUNCTION public.update_streak() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_streak() TO authenticated;

REVOKE ALL ON FUNCTION public.repair_streak_with_freeze() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_streak_with_freeze() TO authenticated;

REVOKE ALL ON FUNCTION public.repair_streak_with_shield() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_streak_with_shield() TO authenticated;

-- Quota counters are written only by edge functions (service role).
REVOKE ALL ON FUNCTION public.increment_daily_usage(uuid, date, integer, real) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_daily_usage(uuid, date, integer, real) TO service_role;
REVOKE ALL ON FUNCTION public.increment_daily_usage(uuid, date, integer, real, real) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_daily_usage(uuid, date, integer, real, real) TO service_role;
REVOKE ALL ON FUNCTION public.increment_daily_usage(uuid, date, integer, real, real, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_daily_usage(uuid, date, integer, real, real, integer, integer, integer) TO service_role;

-- ── 7. Backfill streak marker so existing streaks don't reset ──
UPDATE public.user_profiles
   SET streak_updated_on = CURRENT_DATE
 WHERE streak > 0 AND streak_updated_on IS NULL;
