-- ═══════════════════════════════════════════════════════════════
-- 043: Daily-challenge bonus XP — atomic server-side claim
--
-- The client's claimBonusXp() marked bonus_xp_claimed = true and
-- returned a number the callers ignored — the bonus XP was never
-- actually granted. Clients also cannot be trusted to compute the
-- multiplier or write XP (gamification lockdown, migration 036).
--
-- This RPC does the whole claim in one transaction: validates that
-- today's challenges are complete and unclaimed (row locked FOR
-- UPDATE so double-taps can't double-award), computes the streak
-- multiplier server-side, marks the claim, bumps the challenge
-- streak, and grants the XP via the same guarded path increment_xp
-- uses (GUC recognized by the lockdown trigger).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.claim_daily_challenge_bonus()
RETURNS TABLE(bonus_xp integer, total_xp integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
  v_multiplier numeric;
  v_bonus int;
  v_new_xp int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT c.all_completed, c.bonus_xp_claimed, c.challenge_streak
    INTO v_row
    FROM public.daily_challenges c
   WHERE c.user_id = v_uid AND c.date = CURRENT_DATE
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no daily challenges for today' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(v_row.all_completed, false) THEN
    RAISE EXCEPTION 'daily challenges not all completed' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_row.bonus_xp_claimed, false) THEN
    RAISE EXCEPTION 'bonus already claimed' USING ERRCODE = '22023';
  END IF;

  -- Streak multiplier (mirrors lib/challenges.ts getChallengeMultiplier):
  -- 7+ day streak = 2x, 3+ = 1.5x, else 1x. Hard cap the bonus at 200.
  v_multiplier := CASE
    WHEN COALESCE(v_row.challenge_streak, 0) >= 7 THEN 2.0
    WHEN COALESCE(v_row.challenge_streak, 0) >= 3 THEN 1.5
    ELSE 1.0
  END;
  v_bonus := LEAST(round(50 * v_multiplier)::int, 200);

  UPDATE public.daily_challenges c
     SET bonus_xp_claimed = true,
         challenge_streak = COALESCE(c.challenge_streak, 0) + 1
   WHERE c.user_id = v_uid AND c.date = CURRENT_DATE;

  -- Grant XP the same way increment_xp does internally — the GUC lets
  -- the lockdown trigger (migration 036) accept the write.
  PERFORM set_config('fluenci.gamification_write', '1', true);

  UPDATE public.user_profiles p
     SET total_xp    = p.total_xp + v_bonus,
         xp_level    = public.fluenci_level_for_xp(p.total_xp + v_bonus),
         league_tier = public.fluenci_league_for_level(public.fluenci_level_for_xp(p.total_xp + v_bonus)),
         updated_at  = now()
   WHERE p.user_id = v_uid
   RETURNING p.total_xp INTO v_new_xp;

  RETURN QUERY SELECT v_bonus, COALESCE(v_new_xp, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_challenge_bonus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_challenge_bonus() TO authenticated;
