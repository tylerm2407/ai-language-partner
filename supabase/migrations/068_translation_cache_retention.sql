-- 068_translation_cache_retention.sql
--
-- translation_cache grows without bound. Its key is a sha256 of USER CHAT
-- TEXT, so every distinct message anyone ever asks to translate becomes a
-- permanent row: unbounded in principle, with no expiry column and no sweep.
-- hint_cache is deliberately left alone — it is keyed on
-- (card_id, exercise_type), so it is bounded by the curriculum.
--
-- Retention is 90 days from last use, not from creation: the edge function
-- pushes expires_at forward when it serves a hit that is nearing expiry
-- (see supabase/functions/translate/index.ts). Hot translations therefore
-- live indefinitely and cost nothing to regenerate; one-off messages age out.
--
-- The refresh is deliberately LAZY — only inside the last third of the
-- window — so a cache hit is a plain SELECT almost every time. Touching
-- expires_at on every hit would turn a read-only path into one UPDATE per
-- translation, which is the row churn this table currently avoids.

-- ─── 1. Retention column ─────────────────────────────────────────────────
ALTER TABLE public.translation_cache
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL
  DEFAULT (now() + interval '90 days');

-- Existing rows predate the column; give them a full window from now rather
-- than from their original created_at, so nothing is swept on first run.
UPDATE public.translation_cache
   SET expires_at = now() + interval '90 days'
 WHERE expires_at IS NULL;

-- Supports the sweep's range delete.
CREATE INDEX IF NOT EXISTS translation_cache_expires_at_idx
  ON public.translation_cache (expires_at);

-- ─── 2. Sweep both cache tables ──────────────────────────────────────────
-- Was api_cache only. Returns the combined row count so the cron log is
-- meaningful.
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  api_deleted INTEGER;
  translation_deleted INTEGER;
BEGIN
  DELETE FROM public.api_cache WHERE expires_at < now();
  GET DIAGNOSTICS api_deleted = ROW_COUNT;

  DELETE FROM public.translation_cache WHERE expires_at < now();
  GET DIAGNOSTICS translation_deleted = ROW_COUNT;

  RETURN api_deleted + translation_deleted;
END;
$function$;
