import { useState, useCallback } from 'react';
import type { ReadingMaterial, ReadingAudio, CEFRLevel } from '../types';
import { fetchReadingMaterials, fetchReadingById, fetchReadingAudio } from '../lib/supabase-queries';
import { getReadingHelp } from '../lib/ai';
import type { LanguageCode } from '../types';

interface ReadingFilters {
  level?: CEFRLevel;
  unitId?: string;
  tags?: string[];
  minDifficulty?: number;
  maxDifficulty?: number;
}

export function useReadingLibrary(courseId: string) {
  const [readings, setReadings] = useState<ReadingMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReadings = useCallback(async (filters?: ReadingFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReadingMaterials({
        courseId,
        ...filters,
        limit: 50,
      });
      setReadings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load readings');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  return { readings, loading, error, loadReadings };
}

export function useReadingDetail() {
  const [reading, setReading] = useState<ReadingMaterial | null>(null);
  const [audio, setAudio] = useState<ReadingAudio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReading = useCallback(async (readingId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [readingData, audioData] = await Promise.all([
        fetchReadingById(readingId),
        fetchReadingAudio(readingId),
      ]);
      setReading(readingData);
      setAudio(audioData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reading');
    } finally {
      setLoading(false);
    }
  }, []);

  return { reading, audio, loading, error, loadReading };
}

export function useReadingChat(userId: string, language: LanguageCode) {
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResult, setChatResult] = useState<Record<string, unknown> | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const askAboutReading = useCallback(async (
    readingId: string,
    action: 'summarize' | 'define' | 'comprehension_questions'
  ) => {
    setChatLoading(true);
    setChatError(null);
    try {
      const result = await getReadingHelp({
        userId,
        readingId,
        language,
        action,
      });
      setChatResult(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      setChatError(message);
      return null;
    } finally {
      setChatLoading(false);
    }
  }, [userId, language]);

  return { chatLoading, chatResult, chatError, askAboutReading };
}
