-- ═══════════════════════════════════════════════════════════════
-- 038: TTS audio cache bucket + data integrity constraints
--
-- 1) Private storage bucket for content-addressed TTS audio. The tts
--    edge function caches ElevenLabs output keyed by
--    sha256(voiceId|language|text) — identical requests are served from
--    storage instead of paying for regeneration.
-- 2) cards text NOT NULL enforcement (verified 0 violating rows) and
--    audio text length cap.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. TTS cache bucket (private; service-role access only) ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('tts-cache', 'tts-cache', false)
ON CONFLICT (id) DO NOTHING;

-- ── 2. cards text integrity ──
ALTER TABLE public.cards ALTER COLUMN native_text SET NOT NULL;
ALTER TABLE public.cards ALTER COLUMN target_text SET NOT NULL;
