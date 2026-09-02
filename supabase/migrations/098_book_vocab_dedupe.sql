-- 097 — One profile per book, not per copy of a book.
--
-- The ingest ran more than once without deduplicating on `source_id`, so the
-- library carries the same Gutenberg text twice under two ids: 624 redundant
-- rows in French alone (13% of that language), 8 in German, 26 in Chinese, one
-- each in Spanish and Portuguese.
--
-- That is survivable while the shelf is ordered by `created_at` and nobody
-- reaches page 40. It is not survivable once the shelf is RANKED, because
-- identical copies score identically and land next to each other at the very
-- top — the first thing a learner sees would be the same book twice.
--
-- Fixed here for the ranking only: `book_vocab` keeps one row per
-- (language, source_id), and `rank_books_by_coverage` reads exclusively from
-- `book_vocab`, so the ranked shelf is deduplicated by construction.
-- scripts/build-book-vocab.ts carries the same rule so a rebuild does not
-- reintroduce them.
--
-- The redundant `reading_books` rows themselves are deliberately NOT deleted.
-- They are reachable from the CEFR shelves and from any progress a learner has
-- against them, and removing curriculum rows is a bigger decision than a
-- ranking change gets to make on its own. Raised rather than resolved.
--
-- `source_id` IS NULL is excluded from the rule on purpose: all 144
-- AI-generated books have a null source_id and are genuinely distinct books,
-- so keying on it would collapse the entire generated library to one row.

DELETE FROM public.book_vocab bv
 USING (
   SELECT bv2.book_id,
          row_number() OVER (
            PARTITION BY b.language, b.source_id
            ORDER BY b.created_at, b.id
          ) AS copy_number
     FROM public.book_vocab bv2
     JOIN public.reading_books b ON b.id = bv2.book_id
    WHERE b.source_id IS NOT NULL
 ) dup
 WHERE bv.book_id = dup.book_id
   AND dup.copy_number > 1;
