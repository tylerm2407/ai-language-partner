/**
 * What one "due review" session is made of, and how it is cached.
 *
 * Lives here rather than in hooks/useReviewQueue.ts because two callers need
 * exactly the same payload under exactly the same key: the hook, which reads it
 * stale-while-revalidate, and the offline top-up (lib/offline-packs.ts), which
 * warms it on Wi-Fi so the daily review works with no connection. Two copies of
 * this would drift, and the drift would only show up offline.
 */
import {
  fetchDueReviewItems,
  fetchCardsByIds,
  fetchReviewDeckCards,
  fetchCardsByCourse,
} from './supabase-queries';
import { CHOICE_DISTRACTOR_COUNT } from './review-choices';
import { readCacheKey } from './read-cache';
import type { ReviewItem, Card, LanguageCode } from '../types';

/** Cached together — review items are unusable without their cards. */
export interface ReviewQueuePayload {
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
 * The language is part of the key: one cache entry per language, so switching
 * never paints the deck the learner just left (migration 133).
 */
export function reviewQueueCacheKey(userId: string, language: LanguageCode | null): string {
  return readCacheKey('review-queue', userId, language ?? 'all');
}

/**
 * The learner's deck as a distractor pool. Never throws: a pool failure
 * degrades the question — fewer wrong options — and must not take the whole
 * review down with it.
 */
export async function fetchDeckSafe(userId: string, language: LanguageCode | null): Promise<Card[]> {
  try {
    return await fetchReviewDeckCards(userId, undefined, language);
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
export async function topUpPool(deck: Card[], sample: Card | undefined): Promise<Card[]> {
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

/** Everything the review screen needs for today's due cards, in one payload. */
export async function buildReviewQueuePayload(
  userId: string,
  language: LanguageCode | null,
): Promise<ReviewQueuePayload> {
  const items = await fetchDueReviewItems(userId, undefined, language);
  const cards: Record<string, Card> = {};
  if (items.length === 0) return { items, cards, pool: [] };
  // Cards and deck are independent, so they go out together; the course top-up
  // needs a card in hand and only a tiny deck pays it.
  const [fetched, deck] = await Promise.all([
    fetchCardsByIds(items.map((r) => r.cardId)),
    fetchDeckSafe(userId, language),
  ]);
  fetched.forEach((c) => {
    cards[c.id] = c;
  });
  return { items, cards, pool: await topUpPool(deck, fetched[0]) };
}
