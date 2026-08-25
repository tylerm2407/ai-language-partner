-- ═══════════════════════════════════════════════════════════════
-- 081: Premade avatar preset library
--
-- user_profiles.avatar_preset_id and setAvatarKind(_, 'preset', id) have
-- existed since migration 067 with nothing to point at. This creates the
-- catalogue and the public bucket that fill them, and it is what let the
-- layer-based procedural avatar be deleted: 50 hand-checked illustrations
-- beat a combinatorial builder whose output was only ever as good as its
-- worst layer combination, and which nobody was going to review exhaustively.
--
-- PUBLIC bucket, unlike `avatars`. The generated photo avatars in `avatars`
-- are private because they are pictures of the learner; these are stock
-- artwork shipped with the product, identical for everyone, and fetched
-- before a learner has any reason to trust us with a photo. A signed URL per
-- tile would be 50 signing round-trips to render one grid.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatar-presets',
  'avatar-presets',
  true,
  2 * 1024 * 1024,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Read is public (that is the point of the bucket). Writes stay service_role
-- only, which is the default when no INSERT/UPDATE/DELETE policy exists.
DROP POLICY IF EXISTS "Avatar presets are publicly readable" ON storage.objects;
CREATE POLICY "Avatar presets are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatar-presets');

-- ── Catalogue ────────────────────────────────────────────────────────────
-- Served from the DB rather than bundled so presets can be added, replaced or
-- retired without an App Store release — the same reasoning as the style
-- catalogue in generate-avatar.
CREATE TABLE IF NOT EXISTS public.avatar_presets (
  id            text PRIMARY KEY,
  style_key     text NOT NULL,
  storage_path  text NOT NULL,
  -- Display order in the picker. Interleaved across styles so the grid does
  -- not open on ten near-identical anime faces.
  sort_order    integer NOT NULL,
  -- Soft retire: unpublishing keeps existing avatar_preset_id references
  -- resolvable instead of leaving a learner's avatar pointing at nothing.
  is_published  boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS avatar_presets_published_sort_idx
  ON public.avatar_presets (is_published, sort_order);

ALTER TABLE public.avatar_presets ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.avatar_presets IS
  'Premade avatar library. Images live in the public avatar-presets bucket; user_profiles.avatar_preset_id references id. Client-readable, service-role writable.';

-- Rows are seeded from the objects present in the bucket, so the catalogue can
-- never reference a file that was not uploaded.
INSERT INTO public.avatar_presets (id, style_key, storage_path, sort_order)
SELECT
  replace(o.name, '.jpg', ''),
  split_part(replace(o.name, '.jpg', ''), '-', 2),
  o.name,
  (regexp_replace(o.name, '^s0*(\d+)-.*$', '\1'))::int
FROM storage.objects o
WHERE o.bucket_id = 'avatar-presets'
  AND o.name LIKE 's%.jpg'
  AND o.name NOT LIKE '%/%'
ON CONFLICT (id) DO UPDATE
  SET style_key = EXCLUDED.style_key,
      storage_path = EXCLUDED.storage_path,
      sort_order = EXCLUDED.sort_order;
