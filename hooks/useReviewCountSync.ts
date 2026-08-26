/**
 * Keep the "N cards due" badge honest whenever a screen showing it regains focus.
 *
 * The count is store state, and until this hook existed only ONE of the paths
 * that changes it bothered to refresh it: `useReviewQueue.submitReview`. Three
 * others did not —
 *
 *   • the lesson warm-up (`LessonRunner`), which upserts review items directly,
 *   • `lib/offline-queue` replaying a queued `review-upsert` on reconnect,
 *   • another device, or the simple passage of time pulling a card into "due".
 *
 * — so the badge kept whatever `loadUserData` read at launch. Finishing every
 * due card in a lesson warm-up left the learn page still advertising them.
 *
 * A focus refresh fixes all four at once, which is why it lives here rather
 * than as another `refreshReviewCount` call bolted onto each write path: it is
 * one mechanism that covers writes this app never sees. It costs a `head: true`
 * count query per focus, and `refreshReviewCount` is single-flight per user, so
 * flicking between tabs cannot stampede it.
 */

import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';

export function useReviewCountSync() {
  const { user } = useAuth();
  const refreshReviewCount = useAppStore((s) => s.refreshReviewCount);

  useFocusEffect(
    useCallback(() => {
      const userId = user?.id;
      if (!userId) return;
      // Fire and forget: a failed refresh leaves the previous count in place,
      // which is the right failure mode for a badge — better a stale number
      // than a screen that claims "all caught up" because the network blipped.
      void refreshReviewCount(userId);
    }, [user?.id, refreshReviewCount]),
  );
}
