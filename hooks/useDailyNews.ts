import { useEffect, useState, useCallback } from 'react';
import { fetchDailyNews } from '../lib/supabase-queries';
import type { DailyNewsArticle } from '../types';

export function useDailyNews(targetLanguage: string) {
  const [article, setArticle] = useState<DailyNewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadNews = useCallback(async () => {
    if (!targetLanguage) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchDailyNews(targetLanguage);
      setArticle(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load daily news';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [targetLanguage]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const refresh = useCallback(() => {
    loadNews();
  }, [loadNews]);

  return { article, isLoading, error, refresh };
}
