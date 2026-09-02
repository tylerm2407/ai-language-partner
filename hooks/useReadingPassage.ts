import { useEffect, useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from './useAuth';
import {
  fetchPassage,
  fetchReadingQuestions,
  upsertReadingProgress,
  addCardFromAnnotation,
  NewCardsCapReachedError,
  type AnnotationCardSource,
} from '../lib/supabase-queries';
import { saveErrorCopy } from '../lib/error-copy';
import type { ReadingPassage, ReadingQuestion, ReviewItem } from '../types';

/**
 * Passage loading and progress.
 *
 * No longer carries annotations: `reading_annotations` had 0 rows and no
 * writer, so `selectedAnnotation` was permanently null and no word in any
 * passage was ever tappable. Migration 094 dropped the table. Word lookup and
 * its tooltip state now live in useWordLookup, which the viewer owns —
 * `wordsLookedUp` is passed back in from there so this hook keeps owning the
 * progress row it always did.
 */
interface UseReadingPassageReturn {
  passage: ReadingPassage | null;
  questions: ReadingQuestion[];
  isLoading: boolean;
  error: string | null;
  addToReview: (
    source: AnnotationCardSource,
    courseId: string,
    language?: string | null,
  ) => Promise<ReviewItem | null>;
  completeReading: (comprehensionScore: number, wordsLookedUp: number) => Promise<void>;
}

export function useReadingPassage(passageId: string | null): UseReadingPassageReturn {
  const { user } = useAuth();
  const [passage, setPassage] = useState<ReadingPassage | null>(null);
  const [questions, setQuestions] = useState<ReadingQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          fetchPassage(passageId!),
          fetchReadingQuestions(passageId!),
        ]);

        if (cancelled) return;

        if (passageData) setPassage(passageData);
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

  const addToReview = useCallback(async (
    source: AnnotationCardSource,
    courseId: string,
    /** The learner's target language, from their profile. */
    language?: string | null,
  ): Promise<ReviewItem | null> => {
    if (!user) return null;
    try {
      // The passage's band files the card so it counts toward measured
      // vocabulary.
      //
      // The language is now passed in rather than left null. `ReadingPassage`
      // still does not carry one — the caller supplies the learner's target
      // language, which is not a guess: a passage reached from their own
      // course is in the language they are studying. Leaving it null was the
      // safer default while nothing read the column, but the coverage ranking
      // (migration 096) matches a learner's cards on `language`, so a
      // null-language card is one that never counts toward the shelf ordering
      // for the very language it was learned in.
      return await addCardFromAnnotation(
        user.id,
        source,
        courseId,
        ['reading'],
        passage?.cefrLevel,
        language ?? null,
      );
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
  }, [user, passage]);

  const completeReading = useCallback(async (comprehensionScore: number, wordsLookedUp: number) => {
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
  }, [user, passageId]);

  return {
    passage,
    questions,
    isLoading,
    error,
    addToReview,
    completeReading,
  };
}
