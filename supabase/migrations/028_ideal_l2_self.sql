-- 027: Persist motivation + Ideal L2 Self on user_profiles.
--
-- Rationale:
--   Dörnyei's L2 Motivational Self System (L2MSS) identifies the "Ideal L2 Self" —
--   the learner's vision of themselves using the target language — as the strongest
--   single predictor of L2 learner effort (r ≈ 0.61, see research.md §11.1).
--
--   Previously `motivation_reason` was collected in onboarding but stored only
--   transiently in client-side state (lost on process restart). Making it durable
--   alongside `ideal_l2_self` unlocks personalization across notifications,
--   the home hero, streak-risk copy, and future features.
--
-- RLS:
--   `user_profiles` already has row-level security enabled in migration 004 with
--   a user-scoped policy (`auth.uid() = user_id`). These new columns inherit that
--   policy automatically — no additional policy changes required.
--
-- Additive only: no column drops, no renames, safe to apply to existing data.

alter table public.user_profiles
  add column if not exists motivation_reason text,
  add column if not exists ideal_l2_self text;

comment on column public.user_profiles.motivation_reason is
  'MotivationReason enum persisted from onboarding: travel | family | work | brain | curious.';

comment on column public.user_profiles.ideal_l2_self is
  'Free text, <=300 chars. Learner-described vision of themselves using the language (Dörnyei L2MSS).';
