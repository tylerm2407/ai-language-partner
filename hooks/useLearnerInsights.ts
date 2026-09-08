/**
 * useLearnerInsights — what the tutor knows about this learner, for the UI.
 *
 * Reads the same rows `_shared/learner-context.ts` reads on every paid tutor
 * turn (recurring corrections, struggling SRS cards) and ranks them with
 * `lib/insights.ts`, so the Home card and the tutor's steering agree.
 *
 * Stale-while-revalidate through the read cache: Home paints the last known
 * list instantly and refreshes behind it. A fetch failure with nothing cached
 * is an ERROR the caller must render (CLAUDE.md §5) — an empty card and a
 * failed one look identical otherwise, and "you have no patterns" is a claim.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchLearnedCardCount,
  fetchRecentCorrections,
  fetchStrugglingReviewItems,
} from '../lib/supabase-queries';
import {
  rankRecurringMistakes,
  rankStrugglingWords,
  type RecurringMistake,
  type StrugglingWord,
} from '../lib/insights';
import { cachedFetch, getCached, readCacheKey } from '../lib/read-cache';
import { loadErrorCopy, type ErrorCopy } from '../lib/error-copy';

export interface LearnerInsights {
  mistakes: RecurringMistake[];
  words: StrugglingWord[];
  wordsLearned: number;
}

const EMPTY: LearnerInsights = { mistakes: [], words: [], wordsLearned: 0 };

/** Ranked lists are small; the raw candidate set stays out of the cache. */
const MAX_MISTAKES = 5;
const MAX_WORDS = 8;

function insightsKey(userId: string, language: string): string {
  return readCacheKey('learner-insights', userId, language);
}

async function loadInsights(userId: string, language: string): Promise<LearnerInsights> {
  const [corrections, pairs, wordsLearned] = await Promise.all([
    fetchRecentCorrections(userId, language),
    fetchStrugglingReviewItems(userId),
    fetchLearnedCardCount(userId),
  ]);
  return {
    mistakes: rankRecurringMistakes(corrections, { limit: MAX_MISTAKES }),
    words: rankStrugglingWords(pairs, { limit: MAX_WORDS, language }),
    wordsLearned,
  };
}

/**
 * The most frequent recurring mistake from the LAST loaded insights, or null.
 * Read by the reminder scheduler in the root layout, which has no business
 * running the three insight queries itself just to word a notification.
 */
export async function readCachedTopMistake(userId: string, language: string): Promise<string | null> {
  const cached = await getCached<LearnerInsights>(insightsKey(userId, language));
  return cached?.mistakes[0]?.label ?? null;
}

export function useLearnerInsights(userId: string | undefined, language: string | null | undefined) {
  const [data, setData] = useState<LearnerInsights>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [nonce, setNonce] = useState(0);
  // A reload after a mutation (a struggling word reviewed) must not flash the
  // skeleton over a list that is already on screen.
  const hasData = useRef(false);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!userId || !language) return;
    let cancelled = false;
    if (!hasData.current) setLoading(true);
    setError(null);

    cachedFetch<LearnerInsights>(insightsKey(userId, language), () => loadInsights(userId, language), {
      onCached: (cached) => {
        if (cancelled) return;
        hasData.current = true;
        setData(cached);
        setLoading(false);
      },
    })
      .then(({ data: fresh }) => {
        if (cancelled) return;
        hasData.current = true;
        setData(fresh);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(loadErrorCopy(err, 'your patterns'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, language, nonce]);

  return { ...data, loading, error, retry };
}
