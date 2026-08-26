/**
 * The lesson runner's spaced-repetition write path, plus the warm-up items it
 * prepends to a lesson.
 *
 * Split out of LessonRunner so the rating decision — which is the part with
 * real pedagogical consequences — is testable without mounting a lesson.
 */
import {
  upsertReviewItem,
  tryConsumeNewCardSlot,
} from './supabase-queries';
import { calculateNextReview, createNewReviewItem } from './srs';
import { enqueue, isNetworkError } from './offline-queue';
import type { Exercise, ReviewItem, Card, ReviewRating } from '../types';

// ─── SRS Warm-Up (research.md §5.1 & §13.1) ──────────────────────────────
// Retrieval practice ~50% higher long-term retention than re-study. Starting
// every lesson with 3-5 due SRS items primes the learner and closes the gap
// where review activity and lesson activity were separate surfaces.
export const WARMUP_MAX_ITEMS = 5;
export const WARMUP_FETCH_TIMEOUT_MS = 1500;

export function warmupToExercise(entry: { item: ReviewItem; card: Card }): Exercise {
  const { card } = entry;
  return {
    id: `warmup-${entry.item.id}`,
    lessonId: 'warmup',
    type: 'translate_to_target',
    orderIndex: 0,
    prompt: card.nativeText,
    promptAudioUrl: null,
    correctAnswer: card.targetText,
    acceptedAnswers: [card.targetText],
    options: null,
    hintText: card.exampleSentence ?? null,
    cardId: card.id,
    skillType: card.skillType,
    subskill: card.subskill,
    targetWord: card.targetText,
    explanation: card.exampleSentenceTranslation ?? undefined,
  };
}

/**
 * What the scheduler is told about an answer. Narrower than the lesson's own
 * status set on purpose: a skipped exercise never reaches this module at all.
 */
export type LessonSrsOutcome = 'correct' | 'recovered' | 'wrong';

/**
 * SM-2 rating per outcome.
 *
 * `recovered` — right on the second attempt — is a 3, not a 2, and the choice
 * is deliberate in both directions.
 *
 * SM-2 defines 3 as "correct response recalled with serious difficulty", which
 * is exactly what a second attempt is, given the answer is never revealed
 * before it. And it gives nothing away: calculateNextReview sends a first-seen
 * card to interval 1 on a rating of 2 (a reset) and to interval 1 on a rating
 * of 3 (repetitions 1) — the same next-due either way. The difference only
 * surfaces at the following review, where 3 keeps the repetition counter and
 * costs 0.14 of ease factor instead of resetting the count outright.
 *
 * So the lesson score can say "this did not count" while the scheduler says
 * "you got there, harder than last time", and neither of them is lying.
 *
 * Deliberately not lib/grading.ts's gradeToRating: that needs a response time,
 * which the onAnswer(correct, answer) contract does not carry and which is not
 * worth changing fourteen component signatures to obtain.
 */
const RATING_BY_OUTCOME: Record<LessonSrsOutcome, ReviewRating> = {
  correct: 4,
  recovered: 3,
  wrong: 2,
};

/**
 * Feed a main-lesson exercise result into spaced repetition
 * (.claude/rules/learning.md — "Failed items get added to the review queue
 * immediately"). The rating comes from RATING_BY_OUTCOME, so SM-2 state stays
 * coherent across the lesson and warm-up paths.
 *
 * `existingItems` is the prefetched map of the user's review items for this
 * lesson's cards (see the prefetch effect). Cards with prior history grade
 * from their REAL accumulated SM-2 state (interval/ease factor continue),
 * and are not new — so they skip the daily new-card cap and its counter.
 * If the prefetch failed (`null`) or the card has no row, we fall back to a
 * fresh SM-2 baseline via upsertReviewItem's (user_id, card_id) conflict
 * target — exact for first-seen cards, the common case inside a lesson.
 * Each upsert result is written back into the map so repeat exercises on
 * the same card within one session chain state instead of re-baselining.
 *
 * The daily new-card cap is enforced with tryConsumeNewCardSlot — one
 * atomic check-and-consume RPC (silent skip when the cap is hit), same as
 * saveCorrectionAsCard / addCardFromAnnotation. `introducedThisSession`
 * de-dupes cap accounting when the same card backs multiple exercises or
 * an exercise is retried.
 */
export async function recordLessonSrsResult(
  userId: string,
  cardId: string,
  outcome: LessonSrsOutcome,
  introducedThisSession: Set<string>,
  existingItems: Map<string, ReviewItem> | null,
): Promise<void> {
  const rating = RATING_BY_OUTCOME[outcome];

  const existing = existingItems?.get(cardId);
  if (existing) {
    // Known card: continue accumulated SM-2 state. Not new, so no cap
    // slot is consumed.
    const next = calculateNextReview(existing, rating);
    const payload = {
      id: existing.id,
      userId,
      cardId,
      ...next,
      lastReviewedAt: new Date().toISOString(),
    };
    try {
      const saved = await upsertReviewItem(payload);
      existingItems?.set(cardId, saved);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Network blip: queue the exact failed payload for replay on
      // reconnect, and chain in-session state from the locally computed
      // result so repeat exercises on this card keep advancing SM-2.
      console.warn('[lesson-srs] offline; queueing review upsert for card', cardId);
      await enqueue(userId, { type: 'review-upsert', payload });
      existingItems?.set(cardId, payload);
    }
    return;
  }

  if (!introducedThisSession.has(cardId)) {
    let slotConsumed: boolean;
    try {
      slotConsumed = await tryConsumeNewCardSlot();
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Offline: the atomic cap RPC can't run, so a brand-new card can't be
      // introduced safely. Skip SRS for it — the card is introduced the
      // next time it's answered online.
      console.warn('[lesson-srs] offline; skipping new-card SRS for card', cardId);
      return;
    }
    if (!slotConsumed) {
      console.warn('[lesson-srs] daily new-card cap reached; skipping card', cardId);
      return;
    }
    // Mark before the upsert: the slot is already consumed, so a retry of
    // the same card must not consume a second one.
    introducedThisSession.add(cardId);
  }
  const next = calculateNextReview({ id: '', ...createNewReviewItem(userId, cardId) }, rating);
  const payload = {
    userId,
    cardId,
    ...next,
    lastReviewedAt: new Date().toISOString(),
  };
  try {
    const saved = await upsertReviewItem(payload);
    existingItems?.set(cardId, saved);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    // The cap slot was already consumed (this session), so the upsert must
    // not be lost: queue it for replay. The map is deliberately NOT updated
    // here — the payload has no row id yet, and a repeat exercise simply
    // re-baselines and enqueues again (FIFO replay: last write wins).
    console.warn('[lesson-srs] offline; queueing review upsert for card', cardId);
    await enqueue(userId, { type: 'review-upsert', payload });
  }
}
