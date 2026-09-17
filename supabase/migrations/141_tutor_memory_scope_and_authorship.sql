-- 141 — What Sol remembers, part 2: who wrote the note, and which language it belongs to.
--
-- Migration 108 built `tutor_memory` for exactly one writer (the live voice
-- tutor's end-of-session summariser) and exactly one reader (that same tutor's
-- next session). Two things have changed since.
--
-- 1. MULTI-LANGUAGE. Migration 133 made enrollments plural. `tutor_memory` is
--    keyed on (user_id, target_language), so a learner who adds Japanese meets
--    a tutor that has forgotten they are a nurse, that they hate being
--    interrupted, and that they are moving to Madrid. Those facts were never
--    about Spanish. Their recurring errors and their conversation threads were.
--
--    So scope is split BY KIND, not by table: `personal_fact` and `preference`
--    are account-wide (target_language IS NULL) and the other three stay
--    per-language. The CHECK at the bottom makes that an invariant rather than
--    a convention a future writer can forget.
--
--    The unique key has to move with it. `UNIQUE (user_id, target_language,
--    dedupe_key)` silently stops deduplicating the moment target_language is
--    NULL, because NULL is not equal to NULL — the same learner could end up
--    with six identical copies of "their name is Tyler". `scope_key` is a
--    generated `coalesce(target_language, '*')`, so the constraint has a real
--    value to compare on every row. (PG15's `NULLS NOT DISTINCT` would also
--    work; a generated column works on every version and reads plainly in
--    `\d tutor_memory`.)
--
-- 2. AUTHORSHIP. The learner can now write notes of their own, through the
--    service-role `tutor-memory` edge function — never directly, because the
--    reason migration 108 refused client INSERT and UPDATE has not changed: a
--    note is injected verbatim into a future system prompt. What has changed is
--    that there is now a guarded path where the text is authenticated, length-
--    capped, sanitised and run through the content-safety pipeline before it
--    reaches a row, which is the same treatment every other piece of learner
--    text already gets before it reaches a prompt.
--
--    `source` records which of the three writers produced a note, and it earns
--    its place twice over: the screen groups by it ("you told Sol" reads very
--    differently from "Sol noticed"), and the pruner protects by it — a fact
--    the human typed outranks the model's recollection, and never expires on
--    the 180-day curve.
--
-- Everything here remains DERIVED and disposable. correction_log, review_items
-- and user_profiles are still the records of fact; deleting every row in this
-- table costs the learner personalisation and nothing else.

-- ─── Columns ─────────────────────────────────────────────────────────────

ALTER TABLE public.tutor_memory
  ALTER COLUMN target_language DROP NOT NULL;

ALTER TABLE public.tutor_memory
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'tutor'
    CHECK (source IN ('tutor', 'learner', 'onboarding'));

-- NULL means "never edited". The screen says "edited" only when it is set, so
-- a note the learner has corrected can be told apart from one they accepted.
ALTER TABLE public.tutor_memory
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.tutor_memory
  ADD COLUMN IF NOT EXISTS scope_key text
    GENERATED ALWAYS AS (coalesce(target_language, '*')) STORED;

COMMENT ON COLUMN public.tutor_memory.source IS
  'Who wrote this note: tutor (the end-of-session summariser), learner (typed '
  'by the owner through the guarded tutor-memory function) or onboarding '
  '(seeded from the sign-up answers). Drives display grouping and prune order.';

COMMENT ON COLUMN public.tutor_memory.scope_key IS
  'coalesce(target_language, ''*''). Exists so the uniqueness constraint has a '
  'comparable value on account-wide rows, where target_language is NULL.';

-- ─── Backfill: move the account-wide kinds off their language ─────────────
--
-- Duplicates are possible in principle — the same fact learned once in Spanish
-- and once in French — and they would violate the new unique key, so they are
-- merged rather than dropped: the survivor keeps the highest mention_count and
-- the most recent sighting, which is exactly what the pruner ranks on.

WITH widening AS (
  SELECT id, user_id, dedupe_key, mention_count, last_seen_at, first_seen_at,
         row_number() OVER (
           PARTITION BY user_id, dedupe_key
           ORDER BY mention_count DESC, last_seen_at DESC, id
         ) AS rn,
         sum(mention_count) OVER (PARTITION BY user_id, dedupe_key) AS merged_count,
         min(first_seen_at) OVER (PARTITION BY user_id, dedupe_key) AS merged_first,
         max(last_seen_at)  OVER (PARTITION BY user_id, dedupe_key) AS merged_last
    FROM public.tutor_memory
   WHERE kind IN ('personal_fact', 'preference')
     AND target_language IS NOT NULL
),
losers AS (
  DELETE FROM public.tutor_memory tm
   USING widening w
   WHERE tm.id = w.id AND w.rn > 1
  RETURNING tm.id
)
UPDATE public.tutor_memory tm
   SET target_language = NULL,
       mention_count   = w.merged_count,
       first_seen_at   = w.merged_first,
       last_seen_at    = w.merged_last
  FROM widening w
 WHERE tm.id = w.id
   AND w.rn = 1
   AND NOT EXISTS (SELECT 1 FROM losers l WHERE l.id = tm.id);

-- ─── Keys ────────────────────────────────────────────────────────────────

-- Dropped by lookup rather than by name: the old constraint was declared
-- inline in 108, so its name is whatever Postgres generated, and a hard-coded
-- guess that misses would leave the table with two unique keys and no error.
DO $$
DECLARE
  v_name text;
BEGIN
  SELECT conname INTO v_name
    FROM pg_constraint
   WHERE conrelid = 'public.tutor_memory'::regclass
     AND contype = 'u'
     AND pg_get_constraintdef(oid) LIKE '%target_language%dedupe_key%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.tutor_memory DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.tutor_memory
  DROP CONSTRAINT IF EXISTS tutor_memory_scope_dedupe_key;
ALTER TABLE public.tutor_memory
  ADD CONSTRAINT tutor_memory_scope_dedupe_key UNIQUE (user_id, scope_key, dedupe_key);

-- The invariant, stated to the database. Added after the backfill so it is
-- validated against real rows immediately rather than trusted.
ALTER TABLE public.tutor_memory
  DROP CONSTRAINT IF EXISTS tutor_memory_scope_matches_kind;
ALTER TABLE public.tutor_memory
  ADD CONSTRAINT tutor_memory_scope_matches_kind
    CHECK ((kind IN ('personal_fact', 'preference')) = (target_language IS NULL));

-- The read is now "this language OR account-wide", so the index has to cover
-- both halves. scope_key leads for the same reason target_language did.
CREATE INDEX IF NOT EXISTS idx_tutor_memory_user_scope_recent
  ON public.tutor_memory (user_id, scope_key, last_seen_at DESC);

-- ─── Scope resolution, in one place ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tutor_memory_scope(p_kind text, p_language text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  -- Every writer resolves scope through this, so the CHECK above can only be
  -- violated by SQL that went around all of them.
  SELECT CASE WHEN p_kind IN ('personal_fact', 'preference') THEN NULL ELSE p_language END;
$function$;

-- ─── The tutor's writer, scope-aware ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_tutor_memory(
  p_user_id uuid, p_language text, p_kind text, p_content text, p_session_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_id       uuid;
  v_language text;
BEGIN
  IF p_user_id IS NULL OR p_language IS NULL OR p_content IS NULL THEN
    RAISE EXCEPTION 'tutor memory requires a user, a language and content'
      USING ERRCODE = '22023';
  END IF;

  v_language := public.tutor_memory_scope(p_kind, p_language);

  INSERT INTO public.tutor_memory
    (user_id, target_language, kind, content, source, source_session_id)
  VALUES
    (p_user_id, v_language, p_kind, left(btrim(p_content), 200), 'tutor', p_session_id)
  ON CONFLICT (user_id, scope_key, dedupe_key) DO UPDATE
    SET mention_count     = public.tutor_memory.mention_count + 1,
        last_seen_at      = now(),
        source_session_id = p_session_id
  -- Still deliberately NOT updating `kind` or `content` on conflict, and now
  -- not `source` either: a note the learner typed and the tutor later happened
  -- to repeat is still the learner's, and demoting it to 'tutor' would strip
  -- the prune protection they earned by typing it.
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_tutor_memory(uuid, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_tutor_memory(uuid, text, text, text, uuid)
  TO service_role;

-- ─── The learner's writer ────────────────────────────────────────────────
--
-- service_role only, exactly like the tutor's. The learner reaches it through
-- the `tutor-memory` edge function, which authenticates them, sanitises the
-- text and runs the content-safety pipeline first. Granting this to
-- `authenticated` would hand every learner an unsanitised write into their own
-- future system prompt, which is the thing migration 108 exists to prevent.

CREATE OR REPLACE FUNCTION public.upsert_learner_memory(
  p_user_id uuid, p_language text, p_kind text, p_content text, p_source text DEFAULT 'learner'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_id       uuid;
  v_language text;
  v_content  text := left(btrim(coalesce(p_content, '')), 200);
  v_count    integer;
BEGIN
  IF p_user_id IS NULL OR p_language IS NULL THEN
    RAISE EXCEPTION 'learner memory requires a user and a language'
      USING ERRCODE = '22023';
  END IF;
  IF char_length(v_content) < 3 THEN
    RAISE EXCEPTION 'note is too short' USING ERRCODE = '22023';
  END IF;
  IF p_source NOT IN ('learner', 'onboarding') THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = '22023';
  END IF;

  v_language := public.tutor_memory_scope(p_kind, p_language);

  -- The learner's own notes are capped separately from the tutor's 24. Without
  -- this, a learner could fill the whole budget by hand and the pruner — which
  -- now protects their notes first — would evict everything the tutor learned
  -- about them rather than the other way round.
  SELECT count(*) INTO v_count
    FROM public.tutor_memory
   WHERE user_id = p_user_id
     AND source = 'learner'
     AND dedupe_key <> lower(btrim(regexp_replace(v_content, '\s+', ' ', 'g')));
  IF p_source = 'learner' AND v_count >= 8 THEN
    RAISE EXCEPTION 'note limit reached' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.tutor_memory
    (user_id, target_language, kind, content, source)
  VALUES
    (p_user_id, v_language, p_kind, v_content, p_source)
  ON CONFLICT (user_id, scope_key, dedupe_key) DO UPDATE
    -- A learner restating something the tutor already noted PROMOTES the row.
    -- They have vouched for it, so it stops being a recollection and starts
    -- being a fact — which is what the pruner reads `source` for.
    SET source        = CASE WHEN public.tutor_memory.source = 'learner'
                             THEN public.tutor_memory.source ELSE EXCLUDED.source END,
        last_seen_at  = now(),
        updated_at    = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_learner_memory(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_learner_memory(uuid, text, text, text, text)
  TO service_role;

-- ─── The learner's editor ────────────────────────────────────────────────
--
-- `dedupe_key` is GENERATED from `content`, so rewriting the text recomputes
-- the key — which is correct for a deliberate edit and is exactly why 108
-- refuses to do it inside an ON CONFLICT branch, where it would fork a note
-- instead of merging one. The new key can collide with a note that already
-- exists; that is a merge, not an error, so it is caught and merged here.

CREATE OR REPLACE FUNCTION public.edit_learner_memory(
  p_user_id uuid, p_id uuid, p_content text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_content text := left(btrim(coalesce(p_content, '')), 200);
  v_scope   text;
  v_key     text;
  v_other   uuid;
  v_count   integer;
BEGIN
  IF p_user_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'edit requires a user and a note' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_content) < 3 THEN
    RAISE EXCEPTION 'note is too short' USING ERRCODE = '22023';
  END IF;

  SELECT scope_key, mention_count INTO v_scope, v_count
    FROM public.tutor_memory
   WHERE id = p_id AND user_id = p_user_id;
  IF v_scope IS NULL THEN
    -- Includes "belongs to somebody else": the ownership predicate is in the
    -- SELECT, so a stranger's id is indistinguishable from a deleted one.
    RAISE EXCEPTION 'note not found' USING ERRCODE = 'P0002';
  END IF;

  v_key := lower(btrim(regexp_replace(v_content, '\s+', ' ', 'g')));

  SELECT id INTO v_other
    FROM public.tutor_memory
   WHERE user_id = p_user_id AND scope_key = v_scope AND dedupe_key = v_key AND id <> p_id;

  IF v_other IS NOT NULL THEN
    -- The edited text is already a note. Fold this row into it and keep the
    -- larger mention_count, then delete the row being edited.
    UPDATE public.tutor_memory
       SET mention_count = greatest(mention_count, v_count),
           source        = 'learner',
           last_seen_at  = now(),
           updated_at    = now()
     WHERE id = v_other;
    DELETE FROM public.tutor_memory WHERE id = p_id;
    RETURN v_other;
  END IF;

  UPDATE public.tutor_memory
     SET content      = v_content,
         source       = 'learner',
         last_seen_at = now(),
         updated_at   = now()
   WHERE id = p_id;

  RETURN p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.edit_learner_memory(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edit_learner_memory(uuid, uuid, text)
  TO service_role;

-- ─── The forgetting curve, scope-aware and authorship-aware ──────────────
--
-- Dropped and recreated rather than replaced: the new default parameter would
-- otherwise make every existing three-argument call ambiguous.

DROP FUNCTION IF EXISTS public.prune_tutor_memory(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.prune_tutor_memory(
  p_user_id uuid, p_language text, p_keep integer DEFAULT 24, p_keep_wide integer DEFAULT 12
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  WITH ranked AS (
    SELECT id, scope_key, source, last_seen_at,
           row_number() OVER (
             -- Per scope, because the account-wide set and this language's set
             -- are different budgets. Ranking them together would let a chatty
             -- Spanish session evict "they are a nurse", which is true in every
             -- language and was never Spanish's to spend.
             PARTITION BY scope_key
             ORDER BY
               -- Authorship first: a note the learner typed, or one seeded from
               -- what they said at sign-up, outranks the model's recollection.
               CASE WHEN source = 'tutor' THEN 1 ELSE 0 END,
               -- Then the 108 ordering, unchanged: a fact that has come up in
               -- six sessions outranks small talk from last week.
               mention_count DESC, last_seen_at DESC, id
           ) AS rn
      FROM public.tutor_memory
     WHERE user_id = p_user_id
       AND scope_key IN (coalesce(p_language, '*'), '*')
  )
  DELETE FROM public.tutor_memory tm
   USING ranked r
   WHERE tm.id = r.id
     AND (
       r.rn > CASE WHEN r.scope_key = '*' THEN p_keep_wide ELSE p_keep END
       -- The 180-day curve still applies to what the tutor inferred — a tutor
       -- that still brings up last spring's trip reads as uncanny. It does not
       -- apply to what the learner typed: they did not tell Sol their name so
       -- that it could be forgotten six months later without being asked.
       OR (tm.source = 'tutor' AND tm.last_seen_at < now() - interval '180 days')
     );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.prune_tutor_memory(uuid, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_tutor_memory(uuid, text, integer, integer)
  TO service_role;

COMMENT ON TABLE public.tutor_memory IS
  'What Sol remembers about a learner. Read and DELETE belong to the learner; '
  'every write is service-role — the tutor summariser via upsert_tutor_memory, '
  'the learner via upsert_learner_memory/edit_learner_memory behind the '
  'tutor-memory edge function. personal_fact and preference are account-wide '
  '(target_language IS NULL); the rest are per-language. Every note is derived '
  'and disposable — losing one costs personalisation, never a learning record.';
