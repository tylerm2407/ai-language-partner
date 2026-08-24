-- 072_trim_unwinnable_challenges.sql
--
-- Removes four challenge templates that could never be completed.
--
-- Nothing in the app has ever written minutesPracticed, speakingMinutes or
-- listeningMinutes. The only writers are addStats({lessonsCompleted, xpEarned})
-- on lesson completion, addStats({cardsReviewed}) on review submit, and
-- cards_learned via try_consume_new_card_slot. Live daily_stats confirmed it:
-- zero rows had any of those three columns above 0.
--
-- With 4 of 10 templates dead and 3 drawn at random, only C(6,3)/C(10,3) = 17%
-- of days were completable. Production bore that out exactly — across every
-- daily_challenges row, bonus_xp_claimed was false, all_completed was false and
-- max(challenge_streak) was 0. The bonus had never been claimed by anyone.
--
-- Removed: practice_minutes, practice_minutes_20, speaking_exercise,
--          listening_minutes.
--
-- Mirrors CHALLENGE_POOL in lib/challenges.ts; lib/challenges.test.ts asserts
-- parity between the two and now also asserts that every remaining template
-- tracks a statKey the app actually writes.
--
-- Existing rows: no backfill. A row already holding a removed type simply keeps
-- failing the completion check — which is what it did before this migration —
-- and self-heals when the next day's row is generated from the trimmed pool.
-- Nothing was ever claimed, so there is no history to preserve.

CREATE OR REPLACE FUNCTION public.fluenci_challenge_pool()
RETURNS TABLE (challenge_type text, target numeric, stat_key text)
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT * FROM (VALUES
    ('complete_lessons',    2::numeric,   'lessonsCompleted'),
    ('complete_lessons_3',  3::numeric,   'lessonsCompleted'),
    ('review_cards',        10::numeric,  'cardsReviewed'),
    ('review_cards_20',     20::numeric,  'cardsReviewed'),
    ('xp_target',           100::numeric, 'xpEarned'),
    ('learn_new_cards',     5::numeric,   'cardsLearned')
  ) AS t(challenge_type, target, stat_key);
$function$;

REVOKE EXECUTE ON FUNCTION public.fluenci_challenge_pool() FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- ROLLBACK: re-add the four VALUES rows from migration 071. Note that doing so
-- restores the unwinnable state unless the missing stat writers are wired first.
-- ---------------------------------------------------------------------------
