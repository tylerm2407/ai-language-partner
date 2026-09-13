import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import {
  fetchDueReviewItems,
  fetchCardsByIds,
  fetchStrugglingReviewItems,
  fetchReviewDeckCards,
  fetchCardsByCourse,
  upsertReviewItem,
  insertReviewLogIdempotent,
} from '../lib/supabase-queries';
import { calculateNextReview } from '../lib/srs';
import { CHOICE_DISTRACTOR_COUNT } from '../lib/review-choices';
import { rankStrugglingWords } from '../lib/insights';
import { enqueue, isNetworkError, newClientLogId } from '../lib/offline-queue';
import { cachedFetch, readCacheKey } from '../lib/read-cache';
import type { ReviewItem, Card, ReviewRating } from '../types';

/** Cached together — review items are unusable without their cards. */
interface ReviewQueuePayload {
  items: ReviewItem[];
  cards: Record<string, Card>;
  /**
   * Distractor pool for the multiple-choice format (lib/review-choices.ts):
   * the learner's own deck, topped up from the course when the deck is too
   * small to fill a question. Optional because a queue cached before this
   * field existed has none; the screen treats that as an empty pool.
   */
  pool?: Card[];
}

/**
 * The learner's deck as a distractor pool. Never throws: a pool failure
 * degrades the question — fewer wrong options — and must not take the whole
 * review down with it.
 */
async function fetchDeckSafe(userId: string): Promise<Card[]> {
  try {
    return await fetchReviewDeckCards(userId);
  } catch (err) {
    console.warn('[review] distractor pool failed (non-fatal):', err);
    return [];
  }
}

/**
 * Top a small deck up from its course so a question can still show four
 * options (a brand-new learner has three cards). `sample` supplies the course;
 * without one there is nothing to top up from.
 */
async function topUpPool(deck: Card[], sample: Card | undefined): Promise<Card[]> {
  if (deck.length > CHOICE_DISTRACTOR_COUNT || !sample) return deck;
  try {
    const course = await fetchCardsByCourse(sample.courseId);
    const seen = new Set(deck.map((c) => c.id));
    return [...deck, ...course.filter((c) => !seen.has(c.id))];
  } catch (err) {
    console.warn('[review] course top-up failed (non-fatal):', err);
    return deck;
  }
}

/**
 * Which cards a session is made of.
 *  - `due`: everything SM-2 says is due today. The default, and the only mode
 *    that touches the shared review-queue cache.
 *  - `struggling`: the words the learner keeps failing (see `lib/insights.ts`),
 *    due or not. Reviewing a card early is ordinary SM-2 — the same grading
 *    runs, the interval just restarts from today — so nothing in the scoring
 *    path changes; only which cards are dealt.
 */
export type ReviewQueueMode = 'due' | 'struggling';

export function useReviewQueue(mode: ReviewQueueMode = 'due') {
  const { user } = useAuth();
  const { reviewCount, refreshReviewCount } = useAppStore();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [pool, setPool] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);

  const loadQueue = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (mode === 'struggling') {
        // Not cached: this list changes with every card the learner rates,
        // and a stale copy would deal a word they fixed ten minutes ago.
        const language = useAppStore.getState().profile?.targetLanguage ?? null;
        const ranked = rankStrugglingWords(await fetchStrugglingReviewItems(user.id), { limit: 20, language });
        const map: Record<string, Card> = {};
        ranked.forEach((w) => { map[w.card.id] = w.card; });
        // Pool BEFORE cards: the screen deals the first question the moment
        // cards land, and a question dealt against an empty pool has one row.
        setPool(await topUpPool(await fetchDeckSafe(user.id), ranked[0]?.card));
        setItems(ranked.map((w) => w.item));
        setCards(map);
        return;
      }
      // Stale-while-revalidate: a cached queue paints immediately; a fetch
      // failure with a cache resolves stale instead of throwing, so callers
      // only see an error when there's nothing to show (same as before).
      const { data } = await cachedFetch<ReviewQueuePayload>(
        readCacheKey('review-queue', user.id),
        async () => {
          const reviewItems = await fetchDueReviewItems(user.id);
          const map: Record<string, Card> = {};
          if (reviewItems.length === 0) return { items: reviewItems, cards: map, pool: [] };
          // Cards and deck are independent, so they go out together; the
          // course top-up needs a card in hand and only a tiny deck pays it.
          const [fetched, deck] = await Promise.all([
            fetchCardsByIds(reviewItems.map((r) => r.cardId)),
            fetchDeckSafe(user.id),
          ]);
          fetched.forEach((c) => { map[c.id] = c; });
          return { items: reviewItems, cards: map, pool: await topUpPool(deck, fetched[0]) };
        },
        {
          onCached: (cached) => {
            // A queue cached before the pool existed is not painted: with no
            // distractors the first question would be one trivially-right row,
            // and a tap on it is a real Easy (5) written to SM-2. Waiting for
            // the fetch costs one paint on the first launch after the upgrade.
            if (!cached.pool) return;
            setPool(cached.pool);
            setItems(cached.items);
            setCards(cached.cards);
            setLoading(false);
          },
        },
      );
      setPool(data.pool ?? []);
      setItems(data.items);
      setCards(data.cards);
    } finally {
      setLoading(false);
    }
  }, [user, mode]);

  const submitReview = useCallback(async (
    item: ReviewItem,
    rating: ReviewRating,
    answer: string,
    responseTimeMs: number
  ) => {
    if (!user) return;

    const next = calculateNextReview(item, rating);
    const wasCorrect = rating >= 3;
    const reviewedAt = new Date().toISOString();
    // Minted here, not at enqueue time, so the online attempt and any queued
    // retry are the same review rather than two.
    const clientLogId = newClientLogId();

    const itemPayload = {
      ...item,
      easeFactor: next.easeFactor,
      interval: next.interval,
      repetitions: next.repetitions,
      nextDue: next.nextDue,
      lastReviewedAt: reviewedAt,
      // Use the status SM-2 computed. This previously recomputed it as
      // learning-or-review, which silently dropped 'graduated' — so a card
      // that reached a 21-day interval never actually graduated, and the
      // distinction between "still being learned" and "known" was invisible
      // everywhere downstream, including the proficiency report.
      status: next.status,
    };

    const logPayload = {
      userId: user.id,
      cardId: item.cardId,
      reviewItemId: item.id,
      rating,
      responseTimeMs,
      userAnswer: answer,
      wasCorrect,
      reviewedAt,
      clientLogId,
    };

    // Queue on network failure rather than throwing. Reviews happen on trains
    // and in lifts; losing one because the tunnel arrived mid-tap is a silent
    // data loss the learner cannot detect or repair. Non-network errors still
    // propagate — a schema or permission failure must surface.
    //
    // The two writes go out TOGETHER. They were serial, which cost a full round
    // trip of dead time between every card — about 22s across a 50-card
    // session, all of it while the learner is waiting to see the next card.
    // They are independent and separately idempotent (the item upsert conflicts
    // on (user_id, card_id); the log dedupes on client_log_id), so neither
    // depends on the other having landed.
    const [itemResult, logResult] = await Promise.allSettled([
      upsertReviewItem(itemPayload),
      insertReviewLogIdempotent(logPayload),
    ]);

    // A non-network failure still has to surface, and it must do so AFTER both
    // queue attempts — otherwise throwing on the first would skip queueing the
    // second and lose it.
    let fatal: unknown = null;

    if (itemResult.status === 'rejected') {
      if (isNetworkError(itemResult.reason)) {
        await enqueue(user.id, { type: 'review-upsert', payload: itemPayload });
      } else {
        fatal = itemResult.reason;
      }
    }

    if (logResult.status === 'rejected') {
      if (isNetworkError(logResult.reason)) {
        await enqueue(user.id, { type: 'review-log', payload: logPayload });
      } else {
        fatal ??= logResult.reason;
      }
    }

    if (fatal) throw fatal;

    // Best-effort: a failed count refresh must not make a saved review look
    // like a failed one.
    try {
      await refreshReviewCount(user.id);
    } catch (err) {
      console.warn('[review] refreshReviewCount failed (non-fatal):', err);
    }
  }, [user, refreshReviewCount]);

  return { items, cards, pool, reviewCount, loading, loadQueue, submitReview };
}
