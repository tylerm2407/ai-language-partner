-- Migration 052: Adult mode (gamification opt-out)
--
-- Fluenci targets adults who want to actually speak a language, not farm a
-- streak. Adult mode turns off the pressure mechanics — hearts gating, streak
-- guilt, league standings, XP celebration — and leaves progress expressed as
-- CEFR competence instead.
--
-- Deliberately NOT a gamification column in the guard-trigger sense: this is a
-- user preference, not an economic value, so it is safe for the client to
-- write under its own RLS scope. `fluenci_guard_gamification` (migration 036)
-- lists the protected columns explicitly and does not include this one, so
-- ordinary profile updates continue to work.
--
-- XP, streak and hearts keep accruing server-side while adult mode is on. They
-- are only hidden. Turning the mode off must restore the learner's history
-- intact rather than reveal a reset account.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS adult_mode BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.adult_mode IS
  'When true, the client suppresses hearts gating, streak pressure, league standings and XP celebration. Underlying gamification values continue to accrue server-side.';
