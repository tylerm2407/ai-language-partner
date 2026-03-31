import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import {
  fetchDueReviewItems,
  fetchCardsByIds,
  upsertReviewItem,
  insertReviewLog,
} from '../lib/supabase-queries';
import { calculateNextReview } from '../lib/srs';
import type { ReviewItem, Card, ReviewRating } from '../types';

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
      const reviewItems = await fetchDueReviewItems(user.id);
      setItems(reviewItems);
      if (reviewItems.length > 0) {
        const cardIds = reviewItems.map((r) => r.cardId);
        const fetched = await fetchCardsByIds(cardIds);
        const map: Record<string, Card> = {};
        fetched.forEach((c) => { map[c.id] = c; });
        setCards(map);
      }
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
