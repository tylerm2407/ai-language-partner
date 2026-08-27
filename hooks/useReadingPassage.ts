import { useEffect, useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from './useAuth';
import {
  fetchPassageWithAnnotations,
  fetchReadingQuestions,
  upsertReadingProgress,
  addCardFromAnnotation,
  NewCardsCapReachedError,
} from '../lib/supabase-queries';
import { saveErrorCopy } from '../lib/error-copy';
import type { ReadingPassage, ReadingAnnotation, ReadingQuestion, ReviewItem } from '../types';

interface UseReadingPassageReturn {
  passage: ReadingPassage | null;
  annotations: ReadingAnnotation[];
  questions: ReadingQuestion[];
  isLoading: boolean;
  error: string | null;
  selectedAnnotation: ReadingAnnotation | null;
  wordsLookedUp: number;
  selectWord: (annotation: ReadingAnnotation) => void;
  dismissTooltip: () => void;
  addToReview: (annotation: ReadingAnnotation, courseId: string) => Promise<ReviewItem | null>;
  completeReading: (comprehensionScore: number) => Promise<void>;
}

export function useReadingPassage(passageId: string | null): UseReadingPassageReturn {
  const { user } = useAuth();
  const [passage, setPassage] = useState<ReadingPassage | null>(null);
  const [annotations, setAnnotations] = useState<ReadingAnnotation[]>([]);
  const [questions, setQuestions] = useState<ReadingQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<ReadingAnnotation | null>(null);
  const [wordsLookedUp, setWordsLookedUp] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (!passageId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        startTimeRef.current = Date.now();

        const [passageData, questionsData] = await Promise.all([
          fetchPassageWithAnnotations(passageId!),
          fetchReadingQuestions(passageId!),
        ]);

        if (cancelled) return;

        if (passageData) {
          setPassage(passageData.passage);
          setAnnotations(passageData.annotations);
        }
        setQuestions(questionsData);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load passage');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [passageId]);

  const selectWord = useCallback((annotation: ReadingAnnotation) => {
    setSelectedAnnotation(annotation);
    setWordsLookedUp((prev) => prev + 1);
  }, []);

  const dismissTooltip = useCallback(() => {
    setSelectedAnnotation(null);
  }, []);

  const addToReview = useCallback(async (annotation: ReadingAnnotation, courseId: string): Promise<ReviewItem | null> => {
    if (!user) return null;
    try {
      return await addCardFromAnnotation(user.id, annotation, courseId);
    } catch (err) {
      // This used to be a bare `catch { return null }`. Every failure looked
      // identical to success from the UI, which is how the missing INSERT
      // policy (migration 088) stayed hidden: the tap did nothing, silently.
      if (err instanceof NewCardsCapReachedError) {
        Alert.alert(
          "That's all your new words for today",
          `You've started ${err.cap} new words today. This one will still be here tomorrow — reviewing what you've already started is always unlimited.`,
        );
        return null;
      }
      const { title, message } = saveErrorCopy(err, 'that word to your reviews');
      Alert.alert(title, message);
      return null;
    }
  }, [user]);

  const completeReading = useCallback(async (comprehensionScore: number) => {
    if (!user || !passageId) return;
    const timeSpentMs = Date.now() - startTimeRef.current;
    try {
      await upsertReadingProgress(user.id, passageId, {
        comprehensionScore,
        wordsLookedUp,
        timeSpentMs,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to save reading progress:', err);
      Alert.alert('Save Error', 'Your reading progress could not be saved. Please try again.');
    }
  }, [user, passageId, wordsLookedUp]);

  return {
    passage,
    annotations,
    questions,
    isLoading,
    error,
    selectedAnnotation,
    wordsLookedUp,
    selectWord,
    dismissTooltip,
    addToReview,
    completeReading,
  };
}
