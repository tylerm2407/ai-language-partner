-- ═══════════════════════════════════════════════════════════════
-- 067: Photo-to-avatar generation
--
-- 1) `avatars` private storage bucket. Generated portraits are stylised
--    likenesses of real people, so the bucket is private and each object
--    is readable only by the user whose id prefixes its path. Writes are
--    service-role only (the generate-avatar edge function) — a client that
--    could write here could set any image as any user's avatar.
-- 2) user_profiles gains an avatar discriminator. The existing procedural
--    SVG avatar (migration 016) stays the default so no current account
--    changes appearance; `avatar_kind` selects which renderer to use.
-- 3) daily_usage.avatars_generated + the matching counter in
--    consume_daily_quota, so image generation is metered atomically like
--    every other paid AI call.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Private avatars bucket ──
-- An `avatars` bucket already existed in production (created 2026-03-27) and
-- was PUBLIC, though empty. DO NOTHING would have left it public and served
-- every generated likeness from a guessable URL, so this forces it private and
-- caps what can land in it. Safe precisely because it held no objects.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Objects are stored at `<user_id>/<style>_<timestamp>.png`, so the first
-- path segment is the owner. Read-only for the owner; no INSERT/UPDATE/DELETE
-- policy exists, which is deny-all for clients (service_role bypasses RLS).
DROP POLICY IF EXISTS "Users can read their own avatar" ON storage.objects;
CREATE POLICY "Users can read their own avatar"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- ── 2. Avatar discriminator on user_profiles ──
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_kind text NOT NULL DEFAULT 'procedural',
  ADD COLUMN IF NOT EXISTS avatar_preset_id text,
  ADD COLUMN IF NOT EXISTS avatar_image_path text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_avatar_kind_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_avatar_kind_check
      CHECK (avatar_kind IN ('procedural', 'preset', 'generated'));
  END IF;
END $$;

COMMENT ON COLUMN public.user_profiles.avatar_kind IS
  'Which avatar renderer to use: procedural (SVG from avatar_config, migration 016), preset (bundled illustration keyed by avatar_preset_id), or generated (image at avatar_image_path in the avatars bucket).';

-- ── 3. Metered generation counter ──
ALTER TABLE public.daily_usage
  ADD COLUMN IF NOT EXISTS avatars_generated INTEGER NOT NULL DEFAULT 0;

-- Re-create consume_daily_quota (migration 037) with the new counter added to
-- the allow-list. Body is otherwise unchanged — the counter name is
-- interpolated into dynamic SQL, so the IN check is what keeps it injection-safe.
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
  IF p_counter NOT IN ('text_messages', 'writing_grades', 'pronunciation_scores', 'stories_generated', 'avatars_generated') THEN
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
