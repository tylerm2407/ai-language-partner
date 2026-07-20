-- ═══════════════════════════════════════════════════════════════
-- 047: Server-written response caches for translate + get-hint
--
-- Both edge functions previously made a fresh Haiku call on every request
-- even for identical inputs. These tables let the functions serve repeat
-- requests from Postgres instead:
--   • translation_cache — keyed by sha256 hex of
--     (source_text, source_lang, target_lang); stores the translation.
--   • hint_cache — keyed by (card_id, exercise_type); hints are
--     deterministic per pair, so one generation serves everyone.
--
-- Access model: written ONLY by edge functions using the service role
-- (which bypasses RLS). RLS is enabled with NO policies, so PostgREST
-- clients (anon/authenticated) can neither read nor write rows —
-- same pattern as client_events in migration 046.
-- Indexes: the primary keys cover the only lookup patterns; no extra
-- indexes needed.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. translation_cache ──
CREATE TABLE IF NOT EXISTS public.translation_cache (
  hash        text        PRIMARY KEY,  -- sha256 hex (64 chars) of (source_text, source_lang, target_lang)
  translation text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;

-- ── 2. hint_cache ──
CREATE TABLE IF NOT EXISTS public.hint_cache (
  card_id       uuid        NOT NULL,
  exercise_type text        NOT NULL,
  hint          text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, exercise_type)
);

ALTER TABLE public.hint_cache ENABLE ROW LEVEL SECURITY;
