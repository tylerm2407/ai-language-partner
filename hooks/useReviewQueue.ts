import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import {
  fetchDueReviewItems,
  fetchReviewItemCount,
  fetchCardsByIds,
  upsertReviewItem,
  insertReviewLog,
  upsertDailyStats,
  addXp,
} from '../lib/supabase-queries';
import { calculateNextReview, isCorrect } from '../lib/srs';
import type { ReviewItem, Card, ReviewRating } from '../types';

interface ReviewCard {
  reviewItem: ReviewItem;
  card: Card;
}

interface UseReviewQueueReturn {
  queue: ReviewCard[];
  currentIndex: number;
  currentCard: ReviewCard | null;
  isLoading: boolean;
  error: string | null;
  dueCount: number;
  reviewedCount: number;
  correctCount: number;
  submitReview: (rating: ReviewRating, userAnswer: string, responseTimeMs: number) => Promise<void>;
  refresh: () => Promise<void>;
  isComplete: boolean;
}

export function useReviewQueue(): UseReviewQueueReturn {
  const { user } = useAuth();
  const [queue, setQueue] = useState<ReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const startTimeRef = useRef<number>(Date.now());

  const loadQueue = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const [items, count] = await Promise.all([
        fetchDueReviewItems(user.id, 50),
        fetchReviewItemCount(user.id),
      ]);

      setDueCount(count);

      if (items.length === 0) {
        setQueue([]);
        setIsLoading(false);
        return;
      }

      const cardIds = items.map((item) => item.cardId);
      const cards = await fetchCardsByIds(cardIds);
      const cardMap = new Map(cards.map((c) => [c.id, c]));

      const reviewCards: ReviewCard[] = items
        .filter((item) => cardMap.has(item.cardId))
        .map((item) => ({
          reviewItem: item,
          card: cardMap.get(item.cardId)!,
        }));

      setQueue(reviewCards);
      setCurrentIndex(0);
      setReviewedCount(0);
      setCorrectCount(0);
      startTimeRef.current = Date.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load review queue');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const submitReview = useCallback(
    async (rating: ReviewRating, userAnswer: string, responseTimeMs: number) => {
      if (!user || currentIndex >= queue.length) return;

      const { reviewItem, card } = queue[currentIndex];
      const correct = isCorrect(rating);
      const nextReview = calculateNextReview(reviewItem, rating);

      try {
        // Update SRS state
        await upsertReviewItem({
          ...reviewItem,
          ...nextReview,
          lastReviewedAt: new Date().toISOString(),
        });

        // Log the review
        await insertReviewLog({
          userId: user.id,
          cardId: card.id,
          reviewItemId: reviewItem.id,
          rating,
          responseTimeMs,
          userAnswer,
          wasCorrect: correct,
          reviewedAt: new Date().toISOString(),
        });

        // Update daily stats
        await upsertDailyStats(user.id, {
          cardsReviewed: 1,
          xpEarned: correct ? 10 : 2,
        });

        if (correct) {
          await addXp(user.id, 10);
        }

        setReviewedCount((prev) => prev + 1);
        if (correct) setCorrectCount((prev) => prev + 1);
        setCurrentIndex((prev) => prev + 1);
        setDueCount((prev) => Math.max(0, prev - 1));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to submit review');
      }
    },
    [user, queue, currentIndex]
  );

  const currentCard = currentIndex < queue.length ? queue[currentIndex] : null;
  const isComplete = !isLoading && (queue.length === 0 || currentIndex >= queue.length);

  return {
    queue,
    currentIndex,
    currentCard,
    isLoading,
    error,
    dueCount,
    reviewedCount,
    correctCount,
    submitReview,
    refresh: loadQueue,
    isComplete,
  };
}
