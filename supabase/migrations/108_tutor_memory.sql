-- 108 — The live voice tutor, part 2: what the tutor remembers about you.
--
-- One row per note, deliberately NOT one jsonb blob per learner. A blob is
-- simpler to write and wrong on the two things that matter here: it cannot
-- expire individual facts, and it cannot be deleted granularly. "Make the tutor
-- forget I am moving to Madrid" would mean a client rewriting a jsonb document
-- — which is a client write to a server-owned column, and exactly the shape of
-- the subscription self-grant that migration 057 had to undo.
--
-- Applied to production 2026-09-06.

CREATE TABLE IF NOT EXISTS public.tutor_memory (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_language   text NOT NULL,
  kind              text NOT NULL CHECK (kind IN (
                      'personal_fact','goal','recurring_error','preference','topic_thread')),

  -- The note, written by the end-of-session summariser in the learner's native
  -- language. Hard-capped because this string is injected verbatim into a paid
  -- prompt at the START OF EVERY FUTURE SESSION: an unbounded note is an
  -- unbounded recurring bill, not merely a big row.
  content           text NOT NULL CHECK (char_length(content) BETWEEN 3 AND 200),

  -- GENERATED, never caller-supplied, so nothing can desynchronise it from
  -- `content` and thereby defeat the uniqueness the upsert relies on to stay
  -- idempotent across sessions.
  dedupe_key        text GENERATED ALWAYS AS
                      (lower(btrim(regexp_replace(content, '\s+', ' ', 'g')))) STORED,

  mention_count     integer NOT NULL DEFAULT 1 CHECK (mention_count > 0),
  source_session_id uuid REFERENCES public.tutor_sessions(id) ON DELETE SET NULL,
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_language, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_tutor_memory_user_lang_recent
  ON public.tutor_memory (user_id, target_language, last_seen_at DESC);

ALTER TABLE public.tutor_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tutor memory" ON public.tutor_memory
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- The one deliberate exception to service-role-only writes on this table.
--
-- A learner must be able to make the tutor forget something it remembered about
-- them; that is the entire privacy story for this feature, and a memory you
-- cannot delete is surveillance rather than personalisation. A DELETE has no
-- economic or competitive meaning because every note here is DERIVED, never
-- authoritative — correction_log, review_items and user_profiles remain the
-- records of fact, so deleting a note costs the learner personalisation and
-- nothing else.
--
-- DELETE ONLY. There is deliberately no INSERT and no UPDATE policy: a learner
-- who could author a note could write their own text into a future system
-- prompt, which is prompt injection with a database behind it.
CREATE POLICY "Users forget own tutor memory" ON public.tutor_memory
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

COMMENT ON TABLE public.tutor_memory IS
  'What the live tutor remembers about a learner between sessions. Read and '
  'delete belong to the learner; writes belong to the service role via '
  'upsert_tutor_memory. Every note is derived and disposable — losing one costs '
  'personalisation, never a learning record.';

-- ─── The writer ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_tutor_memory(
  p_user_id uuid, p_language text, p_kind text, p_content text, p_session_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_language IS NULL OR p_content IS NULL THEN
    RAISE EXCEPTION 'tutor memory requires a user, a language and content'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tutor_memory
    (user_id, target_language, kind, content, source_session_id)
  VALUES
    (p_user_id, p_language, p_kind, left(btrim(p_content), 200), p_session_id)
  ON CONFLICT (user_id, target_language, dedupe_key) DO UPDATE
    SET mention_count     = public.tutor_memory.mention_count + 1,
        last_seen_at      = now(),
        source_session_id = p_session_id
  -- Deliberately NOT updating `kind` or `content` on conflict. A note that has
  -- survived five sessions has earned its wording, and letting a later session
  -- rephrase it would change the generated dedupe_key — which would fork the
  -- memory into two near-identical rows rather than merging them, defeating the
  -- entire point of the unique constraint.
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_tutor_memory(uuid, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_tutor_memory(uuid, text, text, text, uuid)
  TO service_role;

-- ─── The forgetting curve ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prune_tutor_memory(
  p_user_id uuid, p_language text, p_keep integer DEFAULT 24
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  WITH ranked AS (
    -- mention_count FIRST, then recency: a fact that has come up in six
    -- sessions ("moving to Madrid") outranks a topic mentioned once last week.
    -- Ordering by recency alone would let small talk evict the biography.
    SELECT id, row_number() OVER (
             ORDER BY mention_count DESC, last_seen_at DESC, id
           ) AS rn
      FROM public.tutor_memory
     WHERE user_id = p_user_id AND target_language = p_language
  )
  DELETE FROM public.tutor_memory tm
   USING ranked r
   WHERE tm.id = r.id
     -- 180 days is the forgetting curve. A tutor that still brings up the trip
     -- you took last spring reads as uncanny, not attentive.
     AND (r.rn > p_keep OR tm.last_seen_at < now() - interval '180 days');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.prune_tutor_memory(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_tutor_memory(uuid, text, integer)
  TO service_role;
