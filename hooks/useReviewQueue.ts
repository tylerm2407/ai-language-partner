import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import {
  fetchDueReviewItems,
  fetchCardsByIds,
  upsertReviewItem,
  insertReviewLogIdempotent,
} from '../lib/supabase-queries';
import { calculateNextReview } from '../lib/srs';
import { enqueue, isNetworkError, newClientLogId } from '../lib/offline-queue';
import { cachedFetch, readCacheKey } from '../lib/read-cache';
import type { ReviewItem, Card, ReviewRating } from '../types';

/** Cached together — review items are unusable without their cards. */
interface ReviewQueuePayload {
  items: ReviewItem[];
  cards: Record<string, Card>;
}

export function useReviewQueue() {
  const { user } = useAuth();
  const { reviewCount, refreshReviewCount } = useAppStore();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [loading, setLoading] = useState(false);

  const loadQueue = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Stale-while-revalidate: a cached queue paints immediately; a fetch
      // failure with a cache resolves stale instead of throwing, so callers
      // only see an error when there's nothing to show (same as before).
      const { data } = await cachedFetch<ReviewQueuePayload>(
        readCacheKey('review-queue', user.id),
        async () => {
          const reviewItems = await fetchDueReviewItems(user.id);
          const map: Record<string, Card> = {};
          if (reviewItems.length > 0) {
            const fetched = await fetchCardsByIds(reviewItems.map((r) => r.cardId));
            fetched.forEach((c) => { map[c.id] = c; });
          }
          return { items: reviewItems, cards: map };
        },
        {
          onCached: (cached) => {
            setItems(cached.items);
            setCards(cached.cards);
            setLoading(false);
          },
        },
      );
      setItems(data.items);
      setCards(data.cards);
    } finally {
      setLoading(false);
    }
  }, [user]);

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
    try {
      await upsertReviewItem(itemPayload);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      await enqueue(user.id, { type: 'review-upsert', payload: itemPayload });
    }

    try {
      await insertReviewLogIdempotent(logPayload);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      await enqueue(user.id, { type: 'review-log', payload: logPayload });
    }

    // Best-effort: a failed count refresh must not make a saved review look
    // like a failed one.
    try {
      await refreshReviewCount(user.id);
    } catch (err) {
      console.warn('[review] refreshReviewCount failed (non-fatal):', err);
    }
  }, [user, refreshReviewCount]);

  return { items, cards, reviewCount, loading, loadQueue, submitReview };
}
