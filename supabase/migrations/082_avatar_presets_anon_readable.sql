-- ═══════════════════════════════════════════════════════════════
-- 082: Let the preset grid render before sign-up
--
-- The onboarding "Make it yours" step runs BEFORE the auth gate — the trial
-- lesson and the identity step both precede it — so an authenticated-only
-- SELECT policy would leave that step with no avatar at all. The step exists
-- for the IKEA effect: the learner builds something of their own before being
-- asked to sign up. Moving the avatar after sign-up would delete the thing
-- the step is for.
--
-- Safe to widen: this table is stock artwork shipped with the product,
-- identical for every learner, and the images it points at already live in a
-- PUBLIC bucket. There is no user data here. It stays SELECT-only — writes
-- remain service_role, which is the default with no write policy.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone signed in can read avatar presets" ON public.avatar_presets;
DROP POLICY IF EXISTS "Avatar presets are readable by anyone" ON public.avatar_presets;

CREATE POLICY "Avatar presets are readable by anyone"
  ON public.avatar_presets FOR SELECT
  TO anon, authenticated
  USING (is_published);
