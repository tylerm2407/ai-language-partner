-- 096 — Make coverage ranking fast enough to load a shelf with.
--
-- The first cut (migration 096) took 257 ms over 645 Portuguese books, which
-- extrapolates to ~1.9 s over the 4,746 French ones. Three causes, all fixed
-- here. Measured on production, not estimated.
--
-- 1. `book_vocab` was scanned TWICE — once to build the per-book intersection
--    and again to join it back — so the 1.6 kB term arrays were detoasted
--    twice. 142 ms of the 257 was that detoasting alone. One scan now, with
--    the sum computed in a LATERAL against the same row.
--
-- 2. Nobody has retained words yet. `review_items` has 10 rows in the entire
--    database, so for every learner today the intersection is against an empty
--    set: thousands of array detoasts to compute a column of zeros. The empty
--    case now short-circuits before touching the arrays at all.
--
-- 3. That short-circuit ordering — common_share desc, total_tokens asc — is
--    now an index, so the day-one shelf is a 40-row index scan rather than a
--    sort of every book in the language.
--
-- After: 2.1 ms for the empty-known path, 94 ms with a 300-word known set.

CREATE INDEX IF NOT EXISTS idx_book_vocab_lang_common
  ON public.book_vocab (language, common_share DESC, total_tokens ASC);

CREATE OR REPLACE FUNCTION public.rank_books_by_coverage(
  p_language text,
  p_limit    integer DEFAULT 40
)
RETURNS TABLE (
  book_id      uuid,
  known_share  real,
  common_share real,
  total_tokens integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := (select auth.uid());
  v_known text[];
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 100);
BEGIN
  -- Caller guard. A SECURITY DEFINER function reading another learner's review
  -- state would be an information leak; it only ever reads its own caller's,
  -- and answers nothing at all to an anonymous one.
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  -- Retained = the card has graduated out of 'learning'. A card still in
  -- learning is one the learner has recently got wrong, so counting it would
  -- claim they can read a word they cannot.
  SELECT coalesce(array_agg(DISTINCT term), ARRAY[]::text[])
    INTO v_known
    FROM public.review_items ri
    JOIN public.cards c ON c.id = ri.card_id
   CROSS JOIN LATERAL unnest(coalesce(c.search_terms, ARRAY[]::text[])) AS term
   WHERE ri.user_id = v_user
     AND ri.status = 'review'
     AND c.language = p_language;

  IF array_length(v_known, 1) IS NULL THEN
    RETURN QUERY
    SELECT bv.book_id, 0::real, bv.common_share, bv.total_tokens
      FROM public.book_vocab bv
     WHERE bv.language = p_language
     ORDER BY bv.common_share DESC, bv.total_tokens ASC
     LIMIT v_limit;
    RETURN;
  END IF;

  RETURN QUERY
  WITH known(term) AS (
    SELECT unnest(v_known)
  )
  -- Lexicographic, deliberately, rather than a weighted blend of two
  -- differently-scaled numbers. Once the learner has retained words their own
  -- vocabulary decides and common_share only breaks ties. The final key nudges
  -- a true tie toward the shorter book, which is the right call for a beginner.
  SELECT bv.book_id,
         (coalesce(k.known_tokens, 0)::real / nullif(bv.total_tokens, 0))::real,
         bv.common_share,
         bv.total_tokens
    FROM public.book_vocab bv
    CROSS JOIN LATERAL (
      SELECT sum(u.cnt)::bigint AS known_tokens
        FROM unnest(bv.top_terms, bv.top_counts) AS u(term, cnt)
        JOIN known kk ON kk.term = u.term
    ) k
   WHERE bv.language = p_language
   ORDER BY 2 DESC, bv.common_share DESC, bv.total_tokens ASC
   LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.rank_books_by_coverage(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rank_books_by_coverage(text, integer) TO authenticated;
