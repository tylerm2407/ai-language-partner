import { useState, useCallback } from 'react';
import type { SpeakingAttempt, LanguageCode } from '../types';
import { fetchSpeakingAttempts } from '../lib/supabase-queries';
import { submitPronunciationForFeedback, type PronunciationScoreResponse } from '../lib/ai';

export function useSpeakingPractice(userId: string, language: LanguageCode) {
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<PronunciationScoreResponse | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const scorePronunciation = useCallback(async (params: {
    audioBase64: string;
    expectedText: string;
    readingId?: string;
    lessonId?: string;
    targetTextRef?: string;
  }) => {
    setScoring(true);
    setScoreError(null);
    setResult(null);
    try {
      const response = await submitPronunciationForFeedback({
        userId,
        audioBase64: params.audioBase64,
        expectedText: params.expectedText,
        language,
        readingId: params.readingId,
        lessonId: params.lessonId,
        targetTextRef: params.targetTextRef,
      });
      setResult(response);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scoring failed';
      setScoreError(message);
      return null;
    } finally {
      setScoring(false);
    }
  }, [userId, language]);

  return { scoring, result, scoreError, scorePronunciation };
}

export function useSpeakingHistory(userId: string) {
  const [attempts, setAttempts] = useState<SpeakingAttempt[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSpeakingAttempts(userId);
      setAttempts(data);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { attempts, loading, loadHistory };
}
