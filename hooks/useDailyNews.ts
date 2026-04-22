import { useEffect, useState, useCallback } from 'react';
import { fetchDailyNews, fetchNewsReadStatus, markNewsAsRead } from '../lib/supabase-queries';
import type { DailyNewsArticle } from '../types';
import type { NewsTier } from '../config/app';

/**
 * Reads today's shared article for (targetLanguage, tier). Articles are
 * pre-generated on a 5 AM ET cron; if the cron hasn't fired yet (or
 * failed), `article` will be null and the UI should show a calm
 * "on its way" state — no error. No user-triggered generation path
 * exists any more; that moved to `daily-news-cron`.
 */
export function useDailyNews(userId: string, targetLanguage: string, tier: NewsTier) {
  const [article, setArticle] = useState<DailyNewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);
  const [isMarking, setIsMarking] = useState<boolean>(false);

  const loadNews = useCallback(async () => {
    if (!userId || !targetLanguage) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setReadAt(null);

    try {
      const data = await fetchDailyNews(targetLanguage, tier);
      setArticle(data);
      if (data) {
        const existingRead = await fetchNewsReadStatus(userId, data.id).catch(() => null);
        setReadAt(existingRead);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load daily news';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [userId, targetLanguage, tier]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const markAsRead = useCallback(async () => {
    if (!article || isMarking || readAt) return;
    setIsMarking(true);
    try {
      const stamp = await markNewsAsRead(article.id);
      setReadAt(stamp);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark as read';
      setError(message);
    } finally {
      setIsMarking(false);
    }
  }, [article, isMarking, readAt]);

  const refresh = useCallback(() => {
    loadNews();
  }, [loadNews]);

  return {
    article,
    isLoading,
    error,
    hasRead: readAt != null,
    readAt,
    markAsRead,
    isMarking,
    refresh,
  };
}
