import { useEffect, useState, useCallback } from 'react';
import { fetchUserDailyNews, generateDailyNews } from '../lib/supabase-queries';
import type { DailyNewsArticle, ProficiencyLevel } from '../types';

export function useDailyNews(userId: string, targetLanguage: string, level: ProficiencyLevel) {
  const [article, setArticle] = useState<DailyNewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadNews = useCallback(async () => {
    if (!userId || !targetLanguage) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchUserDailyNews(userId);
      setArticle(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load daily news';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [userId, targetLanguage]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const generate = useCallback(async () => {
    if (!targetLanguage || !level) return;

    setIsGenerating(true);
    setError(null);

    try {
      const data = await generateDailyNews(targetLanguage, level);
      setArticle(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate article';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }, [targetLanguage, level]);

  const refresh = useCallback(() => {
    loadNews();
  }, [loadNews]);

  return { article, isLoading, isGenerating, error, generate, refresh };
}
