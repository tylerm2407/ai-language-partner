-- 132 — Curriculum-term lookup, so vocabulary audio can be unmetered.
--
-- WHY
-- ---
-- Every vocabulary exercise now draws a Listen button (components/lesson/
-- ListenWordButton.tsx). Hearing the word you are being taught is not a
-- premium feature, so the `tts` function exempts curriculum words from the
-- `lesson_tts_plays` allowance entirely — the free tier gets them without
-- limit.
--
-- That giveaway is bounded rather than open-ended, and this file is what
-- bounds it. The exemption is granted by a fact about the TEXT, never by a
-- claim from the client:
--
--   * `user_id IS NULL` — shared curriculum rows only. Learner-created cards
--     carry learner-supplied text; if they counted, anyone could save a card
--     containing an essay and then synthesise it for free, forever. This
--     clause is the whole security boundary, not a tidiness filter.
--   * The curriculum is finite (~3,100 cards over nine languages) and the tts
--     cache is content-addressed and shared, so each distinct word is paid
--     for once by the first learner to hear it and is a free cache hit for
--     everyone after — a hit never even reaches this lookup.
--
-- Total exposure is therefore a couple of dollars once, across all users, and
-- `scripts/warm-shared-caches.ts` pre-pays even that.

-- ── The index ────────────────────────────────────────────────────────────
-- Expression and predicate both have to match the function below exactly, or
-- the planner will seq-scan `cards` on every uncached play. Partial on
-- `user_id IS NULL` because that is the only half of the table the lookup can
-- ever read, which also keeps it small.
CREATE INDEX IF NOT EXISTS idx_cards_curriculum_term
  ON public.cards (language, lower(btrim(target_text)))
  WHERE user_id IS NULL;

-- ── The lookup ───────────────────────────────────────────────────────────
-- SECURITY INVOKER (the default) on purpose. The only caller is the `tts`
-- edge function holding the service role, which bypasses RLS anyway, so
-- DEFINER would buy nothing and would need the caller guard that
-- .claude/rules and CLAUDE.md §4 require of permission helpers. This is not a
-- permission helper — it answers one question about public curriculum text.
--
-- STABLE, not VOLATILE, so it can be inlined and the index used.
--
-- Comparison is `lower(btrim(...))` on both sides rather than ILIKE: ILIKE
-- would treat `%` and `_` in learner-supplied text as wildcards AND could not
-- use the index above.
CREATE OR REPLACE FUNCTION public.is_curriculum_term(
  p_language text,
  p_text     text
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cards c
    WHERE c.user_id IS NULL
      AND c.language = p_language
      AND lower(btrim(c.target_text)) = lower(btrim(p_text))
  );
$$;

COMMENT ON FUNCTION public.is_curriculum_term(text, text) IS
  'True when the text is the target_text of a SHARED curriculum card (user_id IS NULL) in that language. Used by the tts function to exempt vocabulary audio from the lesson_tts_plays allowance. Learner-created cards deliberately do not count.';

-- Service role only. No client has a reason to call this, and not granting it
-- keeps the surface at exactly one caller.
REVOKE ALL ON FUNCTION public.is_curriculum_term(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_curriculum_term(text, text) TO service_role;
