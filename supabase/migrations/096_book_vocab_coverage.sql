-- 095 — Rank the reading library by how much of a book the learner can already read.
--
-- The library is 10,375 books and the shelf orders them by `created_at desc`,
-- which is to say arbitrarily. Most of them are unreadable for most learners:
-- these are nineteenth-century literary texts, and a beginner opening one at
-- random gets a wall of words they do not know. Coverage ranking is what turns
-- the corpus from a number on a marketing page into a shelf.
--
-- WHY A PRECOMPUTED PROFILE
--
-- `reading_books.content` is 2191 MB of a 2227 MB database. Nothing can
-- tokenize a book at query time, so the corpus is walked once by
-- scripts/build-book-vocab.ts and reduced to about 2 kB per book.
--
-- WHY 200 TERMS PER BOOK
--
-- Measured against production on 2026-09-01: an average book has 6,300-14,500
-- distinct word forms, and its 100 most frequent cover ~50% of running words,
-- its top 300 ~60-84%. A learner's known vocabulary is at most a few hundred
-- words drawn from the common band, so it lands almost entirely inside the
-- book's top 200. Storing 200 costs ~23 MB across the library; an inverted
-- index over the top 1,000 would have cost ~400 MB to capture a few tenths of
-- a percent more intersection.
--
-- WHY `common_share` EXISTS AT ALL
--
-- `review_items` has 10 rows in the whole database. Every learner today has an
-- empty retained set, and a pure intersection would score every book 0.00 and
-- rank nothing — the shelf would look broken to exactly the people it is meant
-- to help. `common_share` is the share of a book's running words that fall in
-- its language's 1,000 most frequent corpus-wide forms: a readability signal
-- that needs no user data, so the ranking is sensible on day one and sharpens
-- as the learner retains words.
--
-- WHY THE CORPUS AND NOT A FREQUENCY LIST
--
-- `scripts/content-pipeline/sources/frequency-lists.ts` can parse an external
-- list, but none has ever been checked in and `cards.frequency_rank` is NULL
-- on all 3,168 rows. Corpus-derived counts are the better input regardless:
-- they describe the register a learner will actually meet in THIS library.

-- ─── Per-language frequency table ────────────────────────────────────────
-- The 1,000 most frequent word forms per language. Small, and kept rather than
-- inlined so `common_share` can be recomputed without a second corpus pass.
CREATE TABLE IF NOT EXISTS public.corpus_terms (
  language    text    NOT NULL,
  term        text    NOT NULL,
  rank        integer NOT NULL,
  token_count bigint  NOT NULL,
  doc_count   integer NOT NULL,
  built_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (language, term)
);

COMMENT ON TABLE public.corpus_terms IS
  'The most frequent word forms per language, counted across every published '
  'reading_books row. Built by scripts/build-book-vocab.ts. `rank` is 1-based '
  'by token_count descending; `doc_count` is how many books contain the form.';

CREATE INDEX IF NOT EXISTS idx_corpus_terms_language_rank
  ON public.corpus_terms (language, rank);

-- ─── Per-book vocabulary profile ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.book_vocab (
  book_id        uuid PRIMARY KEY REFERENCES public.reading_books(id) ON DELETE CASCADE,
  language       text    NOT NULL,
  total_tokens   integer NOT NULL,
  distinct_types integer NOT NULL,
  top_terms      text[]  NOT NULL,
  top_counts     integer[] NOT NULL,
  common_share   real    NOT NULL,
  built_at       timestamptz NOT NULL DEFAULT now(),
  -- The two arrays are read together by position. A length mismatch would not
  -- error, it would silently mis-attribute counts to the wrong words, so it is
  -- refused at write time.
  CONSTRAINT book_vocab_arrays_aligned
    CHECK (array_length(top_terms, 1) IS NOT DISTINCT FROM array_length(top_counts, 1)),
  CONSTRAINT book_vocab_common_share_ratio
    CHECK (common_share >= 0 AND common_share <= 1)
);

COMMENT ON TABLE public.book_vocab IS
  'Per-book vocabulary profile for coverage ranking. `top_terms`/`top_counts` '
  'are the 200 most frequent word forms in the book with their running-word '
  'counts, positionally aligned. Terms are produced by wordTokens() in '
  'lib/reading-text.ts — the SAME tokenizer the reader taps through, because '
  'the intersection is by exact string and a second tokenizer that differed by '
  'one rule would empty it without erroring.';

CREATE INDEX IF NOT EXISTS idx_book_vocab_language ON public.book_vocab (language);

-- Both tables are service-role only: they are written by a batch script and
-- read by the SECURITY DEFINER ranking function below, never by a client. RLS
-- on with zero policies is deny-all to every client role, matching api_cache /
-- hint_cache / translation_cache / explanation_cache. The advisor reports this
-- as INFO rls_enabled_no_policy; that is the intended state.
ALTER TABLE public.corpus_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_vocab   ENABLE ROW LEVEL SECURITY;

-- ─── Tokenized card text ─────────────────────────────────────────────────
-- The learner's known words come from their retained cards, but `target_text`
-- is prose ("S'il vous plaît" is one card and three words), and Postgres has
-- no way to reproduce lib/reading-text.ts's tokenizer exactly. Rather than
-- write a second tokenizer in SQL and let the two drift — which would empty
-- the intersection silently — the tokens are stored, written by the same
-- wordTokens() the corpus build and the reader use.
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS search_terms text[];

COMMENT ON COLUMN public.cards.search_terms IS
  'Normalised word forms of target_text, from wordTokens() in '
  'lib/reading-text.ts. Backfilled for curriculum cards by '
  'scripts/build-book-vocab.ts --backfill-cards; written by the client when a '
  'learner saves a word from the reader. Purely derived — nothing economic '
  'depends on it, which is why the client may write it.';

-- ─── Coverage ranking ────────────────────────────────────────────────────
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
  -- Caller guard. A SECURITY DEFINER function reading another learner's
  -- review state would be an information leak; it only ever reads its own
  -- caller's, and answers nothing at all to an anonymous one.
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

  RETURN QUERY
  WITH known(term) AS (
    SELECT unnest(v_known)
  ),
  -- Hash-join the book's stored terms against the known set. Written as a
  -- join rather than `term = ANY(v_known)` on purpose: `= ANY` on a few
  -- hundred elements is a linear scan per row, and there are ~950k rows for a
  -- language once the arrays are unnested.
  hits AS (
    SELECT bv.book_id AS bid, sum(u.cnt)::bigint AS known_tokens
      FROM public.book_vocab bv
      CROSS JOIN LATERAL unnest(bv.top_terms, bv.top_counts) AS u(term, cnt)
      JOIN known k ON k.term = u.term
     WHERE bv.language = p_language
     GROUP BY bv.book_id
  )
  SELECT bv.book_id,
         (coalesce(h.known_tokens, 0)::real / nullif(bv.total_tokens, 0))::real,
         bv.common_share,
         bv.total_tokens
    FROM public.book_vocab bv
    LEFT JOIN hits h ON h.bid = bv.book_id
   WHERE bv.language = p_language
   -- Lexicographic, deliberately, rather than a weighted blend of two
   -- differently-scaled numbers. With no retained words every known_share is
   -- 0 and the order falls through to common_share, which is the correct
   -- day-one shelf; once the learner has retained words their own vocabulary
   -- decides and common_share only breaks ties. The final key nudges a true
   -- tie toward the shorter book, which is the right call for a beginner.
   ORDER BY 2 DESC, bv.common_share DESC, bv.total_tokens ASC
   LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.rank_books_by_coverage(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rank_books_by_coverage(text, integer) TO authenticated;
