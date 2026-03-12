import type { ReviewItem, ReviewRating } from '../types';
import { SRS_DEFAULTS } from '../config/app';

/**
 * SM-2 spaced repetition algorithm.
 * Takes a review item and the user's rating, returns the updated item.
 */
export function calculateNextReview(
  item: ReviewItem,
  rating: ReviewRating
): Pick<ReviewItem, 'easeFactor' | 'interval' | 'repetitions' | 'nextDue' | 'status'> {
  let { easeFactor, interval, repetitions } = item;

  if (rating < 3) {
    // Failed: reset to learning
    repetitions = 0;
    interval = 1;
  } else {
    // Passed: advance
    repetitions += 1;

    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  easeFactor = Math.max(SRS_DEFAULTS.minimumEaseFactor, easeFactor);

  // Calculate next due date
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + interval);

  // Determine status
  let status: ReviewItem['status'];
  if (repetitions === 0) {
    status = 'learning';
  } else if (interval >= 21) {
    status = 'graduated';
  } else {
    status = 'review';
  }

  return {
    easeFactor,
    interval,
    repetitions,
    nextDue: nextDue.toISOString(),
    status,
  };
}

/**
 * Create a new review item for a card being learned for the first time.
 */
export function createNewReviewItem(userId: string, cardId: string): Omit<ReviewItem, 'id'> {
  return {
    userId,
    cardId,
    easeFactor: SRS_DEFAULTS.initialEaseFactor,
    interval: 0,
    repetitions: 0,
    nextDue: new Date().toISOString(),
    lastReviewedAt: null,
    status: 'new',
  };
}

/**
 * Check if a review item is due for review.
 */
export function isDue(item: ReviewItem): boolean {
  return new Date(item.nextDue) <= new Date();
}

/**
 * Sort review items: overdue first (most overdue at top), then by ease factor (hardest first).
 */
export function sortReviewQueue(items: ReviewItem[]): ReviewItem[] {
  const now = new Date();
  return [...items].sort((a, b) => {
    const aOverdue = now.getTime() - new Date(a.nextDue).getTime();
    const bOverdue = now.getTime() - new Date(b.nextDue).getTime();
    if (aOverdue !== bOverdue) return bOverdue - aOverdue; // most overdue first
    return a.easeFactor - b.easeFactor; // hardest first
  });
}

/**
 * Convert a 0-5 rating to a simple correct/incorrect boolean.
 */
export function isCorrect(rating: ReviewRating): boolean {
  return rating >= 3;
}

/**
 * Detect leech cards (cards that have been reset too many times).
 * A card is a leech if it has been forgotten 8+ times.
 */
export function isLeech(failCount: number): boolean {
  return failCount >= 8;
}
