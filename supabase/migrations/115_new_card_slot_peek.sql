-- 115 — try_consume_new_card_slot without a card id only PEEKS.
--
-- Migration 114 made the review_items insert trigger the enforcer of the
-- daily new-card cap and let the RPC reserve a slot for a named card. Two
-- client paths (addCardFromAnnotation, saveCorrectionAsCard) call the RPC
-- BEFORE the card exists and so cannot name it; under 114 they consumed a
-- slot in the RPC and then the trigger consumed a second one at insert.
--
-- Now: with a card id, reserve (unchanged). Without one, answer whether a
-- slot is free and consume nothing — the trigger charges when the review
-- item lands. Advisory by design: a race between peek and insert surfaces
-- as the trigger's DAILY_NEW_CARD_LIMIT_REACHED, never as a free card.
--
-- Applied to production 2026-09-08 via the Supabase MCP; this file mirrors it.

CREATE OR REPLACE FUNCTION public.try_consume_new_card_slot(p_card_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_today date;
  v_cap int;
  v_used int;
  v_consumed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  v_today := public.fluenci_user_today(v_uid);
  v_cap := COALESCE((public.get_effective_limits(v_uid) ->> 'dailyNewCards')::int, 5);

  -- No card named: peek only.
  IF p_card_id IS NULL THEN
    SELECT COALESCE(d.cards_learned, 0) INTO v_used
      FROM public.daily_stats d
     WHERE d.user_id = v_uid AND d.date = v_today;
    RETURN COALESCE(v_used, 0) < v_cap;
  END IF;

  -- Already reserved (a retry, or the card was introduced before): free.
  IF EXISTS (SELECT 1 FROM public.new_card_reservations r WHERE r.user_id = v_uid AND r.card_id = p_card_id) THEN
    RETURN true;
  END IF;
  -- Already in SRS: not a new card, nothing to reserve.
  IF EXISTS (SELECT 1 FROM public.review_items ri WHERE ri.user_id = v_uid AND ri.card_id = p_card_id) THEN
    RETURN true;
  END IF;

  INSERT INTO public.daily_stats (user_id, date)
  VALUES (v_uid, v_today)
  ON CONFLICT (user_id, date) DO NOTHING;

  UPDATE public.daily_stats d
     SET cards_learned = COALESCE(d.cards_learned, 0) + 1
   WHERE d.user_id = v_uid AND d.date = v_today
     AND COALESCE(d.cards_learned, 0) < v_cap
  RETURNING true INTO v_consumed;

  IF COALESCE(v_consumed, false) THEN
    INSERT INTO public.new_card_reservations (user_id, card_id, reserved_on)
    VALUES (v_uid, p_card_id, v_today)
    ON CONFLICT (user_id, card_id) DO NOTHING;
  END IF;

  RETURN COALESCE(v_consumed, false);
END;
$function$;
