-- 088 — Let learners actually save a card.
--
-- THREE shipped features have never worked, for anyone:
--
--   * "save this word" from a book        (learn/reading/book/[bookId].tsx)
--   * "save this word" from a passage     (addCardFromAnnotation)
--   * "save this correction to review"    (saveCorrectionAsCard, from chat)
--
-- All three insert into `public.cards`, and `cards` has exactly ONE policy — a
-- SELECT. With RLS enabled and no INSERT policy, every one of those writes is
-- refused, every time. `saveCorrectionAsCard` additionally passes
-- `course_id: null` into a NOT NULL column, under a doc comment asserting the
-- column is nullable, so it fails the constraint as well as the policy.
--
-- The failures are swallowed at the call sites (ChatBubble logs a console.warn),
-- so the buttons look like they work.
--
-- WHY A COLUMN ON `cards` AND NOT A NEW TABLE
--
-- `review_items.card_id` is a foreign key to `cards`, and the SRS queue, the
-- hint cache and the lesson runner all read through it. A separate
-- `user_cards` table would fork every one of those read paths. A nullable
-- owner column keeps one card identity and one FK.
--
-- The important consequence is the SELECT policy. `cards` is shared curriculum
-- and its policy is currently unqualified `authenticated` — so a learner's
-- private saved vocabulary, written into that table, would be readable by every
-- other user. The policy is therefore narrowed at the same time as the INSERT
-- is opened; doing one without the other is what would make this a data leak.
--
-- All 3,168 existing rows have `user_id IS NULL` and stay visible to everyone,
-- so no curriculum access changes.

-- ─── Ownership ───────────────────────────────────────────────────────────
-- NULL means curriculum: authored by us, visible to all, owned by nobody.
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.cards.user_id IS
  'Learner who authored this card. NULL = shared curriculum content. Learner '
  'cards are visible only to their owner; see the SELECT policy.';

-- A correction saved from chat genuinely has no course — the learner may be
-- practising a language with no published course at all. The client already
-- assumed this column was nullable; the schema now agrees with it.
ALTER TABLE public.cards ALTER COLUMN course_id DROP NOT NULL;

-- Supports the new SELECT predicate and the per-learner card lookups.
CREATE INDEX IF NOT EXISTS idx_cards_user ON public.cards (user_id)
  WHERE user_id IS NOT NULL;

-- ─── Policies ────────────────────────────────────────────────────────────
-- Read: all curriculum, plus your own.
DROP POLICY IF EXISTS "Authenticated read cards" ON public.cards;
CREATE POLICY "Authenticated read cards" ON public.cards
  FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR user_id = (select auth.uid()));

-- Write: your own only, and never an unowned (curriculum) row. Curriculum is
-- seeded with the service role, which bypasses RLS.
CREATE POLICY "Users can insert own cards" ON public.cards
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NOT NULL AND user_id = (select auth.uid()));

-- Deliberately NO update or delete policy for clients. Editing a card would
-- rewrite the prompt of any review_item pointing at it, and there is no UI for
-- either — service role handles curriculum maintenance.
