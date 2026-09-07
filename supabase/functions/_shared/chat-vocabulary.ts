/**
 * Turn the words a tutor just taught into review cards.
 *
 * This closes a loop whose other half already existed: `learner-context.ts`
 * has always pulled struggling cards back into the tutor's prompt, so the
 * moment these words become cards the tutor starts reusing tomorrow what it
 * introduced today, with no further work.
 *
 * ── Why this is shared rather than copied ─────────────────────────────────
 *
 * Extracted from `ai-chat/index.ts` because a second conversation surface has
 * to write cards the same way. The sequence below is four steps long and every
 * ordering in it is load-bearing (see the numbered comments on
 * `saveChatVocabulary`);
 * a second copy would not stay in step with this one, and the way it would
 * drift is silent — a learner charged a card slot for a card that was never
 * created, discovered only when they run out of them early.
 *
 * It also gives the sequence its first tests. `ai-chat/index.ts` calls
 * `serve()` at module scope, so nothing in it could be imported from a test
 * without standing up an HTTP listener; that is the same reason `prompt.ts`,
 * `parse.ts` and `turn-accuracy.ts` were split out before this.
 *
 * Every write here is best-effort. The learner already has their reply by the
 * time this runs, so failures log and continue — a lost card must never cost
 * someone their conversation.
 */

/**
 * The slice of the Supabase client this module uses.
 *
 * Deliberately loose, matching `learner-context.ts` and `plan-limits.ts`: the
 * PostgREST builder is a long fluent chain whose real type is generated
 * per-schema, and pinning it here would only make the test double harder to
 * write without catching anything this module can get wrong. `rpc` is here
 * too because the quota counter is an RPC, not a table.
 */
export type ChatVocabularyClient = {
  // deno-lint-ignore no-explicit-any
  from: (table: string) => any;
  // deno-lint-ignore no-explicit-any
  rpc: (name: string, params: Record<string, unknown>) => any;
};

/** One word the tutor chose to teach, with its meaning.
 *
 *  Both halves are required. `cards.native_text` is NOT NULL, and a "card"
 *  whose front and back are the same foreign word teaches nothing — which is
 *  why a bare highlighted string (the legacy shape `normalizeVocabulary` still
 *  accepts) renders in the transcript but can never become a card. */
export interface VocabularyCandidate {
  word: string;
  translation: string;
}

/**
 * How many words one turn may bank.
 *
 * A tutor turn offering more than a handful is not teaching vocabulary, it is
 * listing it — and each entry costs a quota slot and two round trips. Three is
 * what `ai-chat` has always used and stays the default so its behaviour is
 * unchanged; a surface that generates fewer, longer turns (the voice tutor
 * banks a whole session rather than a message) passes its own.
 */
export const DEFAULT_MAX_VOCABULARY_CANDIDATES = 3;

/**
 * Tags the card carries.
 *
 * Not cosmetic: this is the only thing on the row that records which surface
 * taught the word, so it is what any later "where did my cards come from"
 * question has to be answered from. Defaults to `ai-chat`'s historical value.
 */
export const DEFAULT_CHAT_CARD_TAGS: readonly string[] = ['chat', 'vocabulary'];

export interface SaveVocabularyInput {
  userId: string;
  targetLanguage: string;
  /** The level the conversation was held at — written to `cards.cefr_level`.
   *  See the insert below for why it is not optional in practice. */
  cefrLevel: string;
  words: VocabularyCandidate[];
  /** `limits.dailyChatCards` — the per-day allowance, passed to the atomic
   *  counter as its ceiling. Zero or less means the caller is not entitled to
   *  chat cards at all and no work is done. */
  limit: number;
  /** Overrides `DEFAULT_CHAT_CARD_TAGS`. */
  tags?: readonly string[];
  /** Overrides `DEFAULT_MAX_VOCABULARY_CANDIDATES`. */
  maxCandidates?: number;
  /** Log prefix, so a failure is attributable to the surface that caused it.
   *  Defaults to the historical `ai-chat` value. */
  fn?: string;
}

/** The counter name in `consume_daily_quota` / `refund_daily_quota`. Shared by
 *  every surface on purpose: the allowance is the learner's, not the feature's,
 *  so a word banked in voice must spend the same budget as one banked in text.
 *  Both RPCs whitelist counter names, and `chat_cards` was missing from the
 *  refund side until migration 107 — see `refundCardSlot`. */
const QUOTA_COUNTER = 'chat_cards';

/**
 * Give back a slot charged for a card that does not exist.
 *
 * Worth its own function because this is where a real production bug lived:
 * `refund_daily_quota` validates its counter name against a whitelist, and
 * `chat_cards` was not on it, so every refund raised — and because both call
 * sites discarded the result, nothing ever said so. The charge stood and the
 * learner silently lost a slot on every failed insert. Migration 107 fixed the
 * whitelist; checking the result here is what would have made the next such
 * mismatch a log line instead of a year of quiet drift.
 *
 * Still non-fatal. A failed refund is a lost slot, not a lost conversation.
 */
async function refundCardSlot(
  supabase: ChatVocabularyClient,
  userId: string,
  fn: string,
): Promise<void> {
  const { error } = await supabase.rpc('refund_daily_quota', {
    p_user_id: userId,
    p_counter: QUOTA_COUNTER,
    p_amount: 1,
  });
  if (error) {
    console.warn(`[${fn}] ${QUOTA_COUNTER} refund failed (slot lost):`, error.message);
  }
}

/**
 * Save the taught words as review cards, and report which ones stuck.
 *
 * The four steps per word, and why they are in this order:
 *
 *   1. DEDUPE FIRST. The existing-card lookup happens before anything is
 *      charged, because a word the learner is already studying must not cost a
 *      slot and the read is free either way. Without it a tutor that says
 *      "la cuenta" across ten sessions builds ten cards, each with its own
 *      independent SM-2 schedule.
 *   2. CHARGE SECOND. `consume_daily_quota` is an atomic check-and-increment;
 *      charging after the insert would let two concurrent sessions both pass
 *      the check and both insert, which is how a daily cap stops being one.
 *   3. INSERT THIRD.
 *   4. REFUND ON ANY FAILURE AFTER THE CHARGE. Both failure paths below give
 *      the slot back, including the `review_items` one: an unscheduled card is
 *      not a review card, so it should not have been charged for.
 *
 * Returns the words that actually became cards, so the UI can tell the learner
 * which ones are coming back.
 */
export async function saveChatVocabulary(
  supabase: ChatVocabularyClient,
  input: SaveVocabularyInput,
): Promise<string[]> {
  const fn = input.fn ?? 'ai-chat';
  const tags = [...(input.tags ?? DEFAULT_CHAT_CARD_TAGS)];
  const maxCandidates = input.maxCandidates ?? DEFAULT_MAX_VOCABULARY_CANDIDATES;

  const saved: string[] = [];
  const candidates = input.words
    .filter((w) => w.word && w.translation)
    .slice(0, Math.max(0, maxCandidates));
  if (candidates.length === 0 || input.limit <= 0) return saved;

  for (const { word, translation } of candidates) {
    try {
      // (1) Already studying it? Nothing to do, and nothing to charge.
      const { data: existing } = await supabase
        .from('cards')
        .select('id')
        .eq('user_id', input.userId)
        .eq('language', input.targetLanguage)
        .ilike('target_text', word)
        .limit(1);
      if (Array.isArray(existing) && existing.length > 0) continue;

      // (2) Charge before inserting — see the note above.
      const { data: allowed, error: quotaErr } = await supabase.rpc('consume_daily_quota', {
        p_user_id: input.userId,
        p_counter: QUOTA_COUNTER,
        p_limit: input.limit,
        p_amount: 1,
      });
      // Fail closed on a broken counter, and stop trying for this turn — the
      // next word would hit the same error.
      if (quotaErr) {
        console.warn(`[${fn}] ${QUOTA_COUNTER} quota check failed:`, quotaErr.message);
        break;
      }
      if (allowed !== true) break; // day's allowance spent

      // (3) Insert.
      const { data: card, error: cardErr } = await supabase
        .from('cards')
        .insert({
          user_id: input.userId,
          course_id: null,
          unit_id: null,
          native_text: translation,
          target_text: word,
          language: input.targetLanguage,
          // Tagged with the level the conversation was held at. Without this
          // the card is invisible to `analyzeBands`, which skips items with a
          // null cefr_level — the card would exist, be reviewed, and still
          // never count toward the learner's own measured vocabulary.
          cefr_level: input.cefrLevel,
          skill_type: 'vocabulary',
          source_type: 'manual',
          tags,
        })
        .select('id')
        .single();

      if (cardErr || !card) {
        // (4) Charged for nothing.
        await refundCardSlot(supabase, input.userId, fn);
        console.warn(`[${fn}] chat card insert failed:`, cardErr?.message);
        continue;
      }

      const { error: reviewErr } = await supabase.from('review_items').upsert(
        {
          user_id: input.userId,
          card_id: card.id,
          ease_factor: 2.5,
          interval: 0,
          repetitions: 0,
          next_due: new Date().toISOString(),
          last_reviewed_at: null,
          status: 'new',
        },
        { onConflict: 'user_id,card_id' },
      );
      if (reviewErr) {
        // (4) The card exists but is not scheduled, so it is not a review card
        // and should not have been charged for.
        await refundCardSlot(supabase, input.userId, fn);
        console.warn(`[${fn}] chat card review_item failed:`, reviewErr.message);
        continue;
      }

      saved.push(word);
    } catch (err) {
      // Deliberately inside the loop: one malformed word must not cost the
      // learner the rest of the turn's vocabulary. Note the asymmetry this
      // accepts — a throw *after* the charge cannot be refunded here, because
      // we do not know whether it came from the insert or the schedule. That
      // is the safe direction to be wrong in (the learner loses a slot, not a
      // card), and it is why the RPC results above are checked rather than
      // relied upon to throw.
      console.warn(`[${fn}] chat vocabulary save failed (non-fatal):`, err);
    }
  }

  return saved;
}
