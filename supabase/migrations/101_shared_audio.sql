-- 101 — Shared, pre-rendered audio: checkpoint listening items and audiobooks.
--
-- Both follow the `news-audio` pattern: render once, store in a PRIVATE bucket,
-- serve a short-lived signed URL. Private matters — a public bucket is a
-- permanent unauthenticated CDN for content we pay per byte to produce.
--
-- WHY AUDIOBOOKS ARE NOT PRE-GENERATED
--
-- The settled design said "pre-generated per chapter". Two measurements say it
-- cannot be:
--
--   1. `reading_books.chapter_breaks` is populated on 384 of 9,864 books
--      (3.9%). There are no chapters to key on for the other 96%.
--   2. fish.audio bills ~$15 per 1M UTF-8 bytes. An average book is 211 kB,
--      so narrating one costs ~$3.17 and the library costs ~$31,000. For books
--      nobody has opened.
--
-- So segments are fixed-size windows of the text rather than chapters, and
-- they are rendered ON FIRST LISTEN and then shared. A learner cannot tell the
-- difference — the first person to play segment 3 waits, everyone after does
-- not — and the spend follows what is actually listened to.

-- ─── Buckets ─────────────────────────────────────────────────────────────
-- No storage.objects policies, deliberately: the edge functions hold the
-- service role and minting a signed URL is the only way in, so their auth
-- check is the sole gate. Same posture as `news-audio` (migration 079).
INSERT INTO storage.buckets (id, name, public)
VALUES ('checkpoint-audio', 'checkpoint-audio', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('book-audio', 'book-audio', false)
ON CONFLICT (id) DO NOTHING;

-- ─── Checkpoint listening audio ──────────────────────────────────────────
-- Rendered once when the item pool is seeded, not per attempt: the pool is
-- fixed and shared, so a checkpoint costs no synthesis at all.
ALTER TABLE public.checkpoint_items
  ADD COLUMN IF NOT EXISTS audio_path text;

COMMENT ON COLUMN public.checkpoint_items.audio_path IS
  'Object key in the private `checkpoint-audio` bucket. Rendered at seed time '
  'from audio_text, which never leaves the server — for a listening item the '
  'text IS the answer.';

-- ─── Audiobook segments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.book_audio (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       uuid NOT NULL REFERENCES public.reading_books(id) ON DELETE CASCADE,
  segment_index integer NOT NULL,
  -- Character offsets into reading_books.content, so a segment can be tied
  -- back to the text the reader is showing.
  char_start    integer NOT NULL,
  char_end      integer NOT NULL,
  audio_path    text,
  duration_ms   integer,
  provider      text,
  voice_id      text,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'generating', 'ready', 'failed')),
  generated_at  timestamptz,
  UNIQUE (book_id, segment_index)
);

COMMENT ON TABLE public.book_audio IS
  'One narrated segment of a book, shared by every listener. Segments are '
  'fixed-size windows of the text rather than chapters: chapter_breaks is '
  'populated on under 4% of the library. Rendered on first listen — '
  'pre-rendering all 9,864 books would cost ~$31,000 for audio nobody had '
  'asked for.';

CREATE INDEX IF NOT EXISTS idx_book_audio_book ON public.book_audio (book_id, segment_index);

ALTER TABLE public.book_audio ENABLE ROW LEVEL SECURITY;
-- No policies: clients reach segments through the `audiobook` edge function,
-- which checks entitlement and mints the signed URL. A readable audio_path
-- would not itself grant access (the bucket is private), but there is no
-- reason for a client to see one.
