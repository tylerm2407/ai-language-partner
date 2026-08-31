-- 092 — Retire the "Earn 100 XP" daily challenge.
--
-- XP is no longer shown to learners anywhere: it survives as a server-side
-- idempotent ledger that offline replay and achievements depend on, but the
-- product talks about measured proficiency instead. A daily challenge whose
-- goal is a number the learner cannot see is not a goal — they would have no
-- way to tell how close they were, or that they had finished it.
--
-- The other five challenges are all denominated in things the learner can
-- observe directly: lessons completed, cards reviewed, cards learned.
--
-- This pool is the SERVER's list, and it is authoritative: since the hardening
-- of `claim_daily_challenge_bonus`, the client's `target` and `stat_key` are
-- not trusted and the bonus is validated against these rows. `lib/challenges.ts`
-- mirrors it for display, and `lib/challenges.test.ts` asserts the two agree in
-- both directions — so removing the entry from only one side fails the build,
-- which is the point.

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
    ('learn_new_cards',     5::numeric,   'cardsLearned')
  ) AS t(challenge_type, target, stat_key);
$function$;
