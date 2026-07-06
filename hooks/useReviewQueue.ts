import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import {
  fetchDueReviewItems,
  fetchCardsByIds,
  upsertReviewItem,
  insertReviewLog,
} from '../lib/supabase-queries';
import { calculateNextReview } from '../lib/srs';
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

    await upsertReviewItem({
      ...item,
      easeFactor: next.easeFactor,
      interval: next.interval,
      repetitions: next.repetitions,
      nextDue: next.nextDue,
      lastReviewedAt: new Date().toISOString(),
      status: next.repetitions === 0 ? 'learning' : 'review',
    });

    await insertReviewLog({
      userId: user.id,
      cardId: item.cardId,
      reviewItemId: item.id,
      rating,
      responseTimeMs,
      userAnswer: answer,
      wasCorrect,
      reviewedAt: new Date().toISOString(),
    });

    await refreshReviewCount(user.id);
  }, [user, refreshReviewCount]);

  return { items, cards, reviewCount, loading, loadQueue, submitReview };
}
