/**
 * The lesson runner's spaced-repetition write path, plus the warm-up items it
 * prepends to a lesson.
 *
 * Split out of LessonRunner so the rating decision — which is the part with
 * real pedagogical consequences — is testable without mounting a lesson.
 *
 * Every card-linked answer, warm-up or main lesson, lands as TWO rows: the
 * `review_items` upsert that moves the schedule, and a `review_logs` row that
 * records the review happened. The log used to be missing from lessons
 * entirely — only the review screen wrote one — and the proficiency report's
 * confidence gate counts logs, so a learner who only ever did lessons could
 * never be measured. Both phases now go through one `persistReview` so the
 * two paths cannot drift apart again.
 */
import {
  upsertReviewItem,
  tryConsumeNewCardSlot,
  insertReviewLogIdempotent,
} from './supabase-queries';
import { calculateNextReview, createNewReviewItem } from './srs';
import {
  enqueue,
  isNetworkError,
  newClientLogId,
  type ReviewLogPayload,
  type ReviewUpsertPayload,
} from './offline-queue';
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
 * Deliberately not lib/grading.ts's gradeToRating: that grades on response
 * time, and a lesson exercise's clock includes reading the prompt, listening
 * to the audio and typing — it is not the recall latency the review screen's
 * four-option pick measures.
 */
export const RATING_BY_OUTCOME: Record<LessonSrsOutcome, ReviewRating> = {
  correct: 4,
  recovered: 3,
  wrong: 2,
};

/**
 * What the `review_logs` row records about the answer itself. `responseTimeMs`
 * is measured from when the exercise was shown; `userAnswer` is whatever the
 * exercise component reported, capped below so a free-production paragraph
 * does not become a 4 KB log row.
 */
export interface LessonAnswerEvidence {
  userAnswer: string;
  responseTimeMs: number;
}

const MAX_LOGGED_ANSWER_CHARS = 500;

/**
 * Returns WHY nothing was written when nothing was. This used to be a bare
 * `void` with a console.warn on the cap path, which was survivable while the
 * cap was 20/day for everyone and nobody reached it. It is not survivable now
 * that the cap is what the free tier is metered on: a learner would quietly
 * stop accumulating review material with no way to find out. The caller is
 * expected to surface 'cap-reached'.
 */
export type LessonSrsWriteResult =
  | { status: 'written' }
  | { status: 'skipped'; reason: 'cap-reached' | 'offline' };

/**
 * The one write path. Upserts the review item, then writes the log that
 * says the review happened, queueing either for replay on a network error.
 *
 * `existingItems` is written back so repeat exercises on the same card within
 * one session chain state instead of re-baselining. On a network failure the
 * locally computed payload stands in for the server row — but only when it
 * already carries a row id (a known card): a first-seen card's payload has no
 * id yet, and a repeat exercise on it simply re-baselines and enqueues again
 * (FIFO replay: last write wins).
 *
 * The log needs `review_item_id`, which for a first-seen card only exists once
 * the upsert has landed. When that upsert had to be queued, the log is queued
 * behind it with an empty id and the replay fills it in (lib/offline-queue.ts,
 * case 'review-log') — the evidence is delayed, not dropped.
 *
 * `wasCorrect` is first-attempt correctness, the same rule as lesson accuracy:
 * a recovered answer taught, it did not count. The rating still says 3, so the
 * scheduler and the report are told the same story from two columns.
 */
async function persistReview(args: {
  userId: string;
  cardId: string;
  payload: ReviewUpsertPayload;
  outcome: LessonSrsOutcome;
  evidence: LessonAnswerEvidence;
  existingItems: Map<string, ReviewItem> | null;
}): Promise<void> {
  const { userId, cardId, payload, outcome, evidence, existingItems } = args;
  const rating = RATING_BY_OUTCOME[outcome];
  const reviewedAt = payload.lastReviewedAt ?? new Date().toISOString();
  // Minted here, not at enqueue time, so the online attempt and any queued
  // retry are the same review rather than two (migration 059).
  const clientLogId = newClientLogId();

  let reviewItemId = payload.id ?? '';
  try {
    const saved = await upsertReviewItem(payload);
    existingItems?.set(cardId, saved);
    reviewItemId = saved.id;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    console.warn('[lesson-srs] offline; queueing review upsert for card', cardId);
    await enqueue(userId, { type: 'review-upsert', payload });
    if (payload.id) existingItems?.set(cardId, { ...payload, id: payload.id });
  }

  const log: ReviewLogPayload = {
    userId,
    cardId,
    reviewItemId,
    rating,
    responseTimeMs: Math.max(0, Math.round(evidence.responseTimeMs)),
    userAnswer: evidence.userAnswer.slice(0, MAX_LOGGED_ANSWER_CHARS),
    wasCorrect: outcome === 'correct',
    reviewedAt,
    clientLogId,
  };

  if (!reviewItemId) {
    // No row to point at yet — see the docblock. Queued behind the upsert.
    await enqueue(userId, { type: 'review-log', payload: log });
    return;
  }
  try {
    await insertReviewLogIdempotent(log);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    console.warn('[lesson-srs] offline; queueing review log for card', cardId);
    await enqueue(userId, { type: 'review-log', payload: log });
  }
}

/**
 * Feed a warm-up answer into spaced repetition.
 *
 * A warm-up item is a due card with an existing `review_items` row, so it
 * always continues real SM-2 state and never touches the new-card cap. It
 * gets one attempt (lib/lesson-attempts.ts maxAttempts), so the outcome is
 * only ever pass or fail — no `recovered` case — and the rating comes from the
 * same table the main lesson uses.
 *
 * This used to be an inline upsert in LessonRunner with its own rating
 * literals. Sharing `persistReview` is what guarantees the warm-up writes the
 * same two rows, with the same offline handling, as a main-lesson answer.
 */
export async function recordWarmupSrsResult(
  item: ReviewItem,
  correct: boolean,
  existingItems: Map<string, ReviewItem> | null,
  evidence: LessonAnswerEvidence,
): Promise<LessonSrsWriteResult> {
  const outcome: LessonSrsOutcome = correct ? 'correct' : 'wrong';
  const next = calculateNextReview(item, RATING_BY_OUTCOME[outcome]);
  const payload: ReviewUpsertPayload = {
    id: item.id,
    userId: item.userId,
    cardId: item.cardId,
    ...next,
    lastReviewedAt: new Date().toISOString(),
  };
  await persistReview({
    userId: item.userId,
    cardId: item.cardId,
    payload,
    outcome,
    evidence,
    existingItems,
  });
  return { status: 'written' };
}

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
 *
 * The daily new-card cap is enforced with tryConsumeNewCardSlot — one atomic
 * check-and-consume RPC, same as saveCorrectionAsCard / addCardFromAnnotation.
 * `introducedThisSession` de-dupes cap accounting when the same card backs
 * multiple exercises or an exercise is retried.
 */
export async function recordLessonSrsResult(
  userId: string,
  cardId: string,
  outcome: LessonSrsOutcome,
  introducedThisSession: Set<string>,
  existingItems: Map<string, ReviewItem> | null,
  evidence: LessonAnswerEvidence,
): Promise<LessonSrsWriteResult> {
  const rating = RATING_BY_OUTCOME[outcome];

  const existing = existingItems?.get(cardId);
  if (existing) {
    // Known card: continue accumulated SM-2 state. Not new, so no cap
    // slot is consumed.
    const next = calculateNextReview(existing, rating);
    const payload: ReviewUpsertPayload = {
      id: existing.id,
      userId,
      cardId,
      ...next,
      lastReviewedAt: new Date().toISOString(),
    };
    await persistReview({ userId, cardId, payload, outcome, evidence, existingItems });
    return { status: 'written' };
  }

  if (!introducedThisSession.has(cardId)) {
    let slotConsumed: boolean;
    try {
      slotConsumed = await tryConsumeNewCardSlot(cardId);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // Offline: the atomic cap RPC can't run, so a brand-new card can't be
      // introduced safely. Skip SRS for it — the card is introduced the
      // next time it's answered online.
      console.warn('[lesson-srs] offline; skipping new-card SRS for card', cardId);
      return { status: 'skipped', reason: 'offline' };
    }
    if (!slotConsumed) {
      return { status: 'skipped', reason: 'cap-reached' };
    }
    // Mark before the upsert: the slot is already consumed, so a retry of
    // the same card must not consume a second one.
    introducedThisSession.add(cardId);
  }
  const next = calculateNextReview({ id: '', ...createNewReviewItem(userId, cardId) }, rating);
  const payload: ReviewUpsertPayload = {
    userId,
    cardId,
    ...next,
    lastReviewedAt: new Date().toISOString(),
  };
  // The cap slot was already consumed (this session), so the upsert must not
  // be lost: persistReview queues it for replay on a network error.
  await persistReview({ userId, cardId, payload, outcome, evidence, existingItems });
  return { status: 'written' };
}
