import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { fetchLessonCompletions, upsertLessonCompletion } from '../lib/supabase-queries';
import { enqueue, isNetworkError } from '../lib/offline-queue';
import type { LessonCompletion } from '../types';

export type LessonState = 'completed' | 'active' | 'locked';

interface LessonProgressState {
  completions: Map<string, LessonCompletion>;
  loading: boolean;
}

export function useLessonProgress(courseId?: string) {
  const { user } = useAuth();
  const [state, setState] = useState<LessonProgressState>({
    completions: new Map(),
    loading: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setError(null);
    fetchLessonCompletions(user.id, courseId)
      .then((data) => {
        if (cancelled) return;
        const map = new Map<string, LessonCompletion>();
        for (const c of data) {
          map.set(c.lessonId, c);
        }
        setState({ completions: map, loading: false });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load lesson progress');
        setState((prev) => ({ ...prev, loading: false }));
      });
    return () => { cancelled = true; };
  }, [user?.id, courseId, reloadKey]);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true }));
    setReloadKey((k) => k + 1);
  }, []);

  const getLessonState = useCallback(
    (lessonId: string, orderedLessonIds: string[]): LessonState => {
      if (state.completions.has(lessonId)) return 'completed';
      const idx = orderedLessonIds.indexOf(lessonId);
      if (idx === 0) return 'active';
      // Active if previous lesson is completed
      if (idx > 0 && state.completions.has(orderedLessonIds[idx - 1])) return 'active';
      return 'locked';
    },
    [state.completions]
  );

  const getScore = useCallback(
    (lessonId: string): number | null => {
      return state.completions.get(lessonId)?.score ?? null;
    },
    [state.completions]
  );

  const markLessonComplete = useCallback(
    async (lessonId: string, courseId: string, score: number, xpEarned: number, timeSpentMs: number) => {
      if (!user?.id) return;
      let completion: LessonCompletion;
      try {
        completion = await upsertLessonCompletion(user.id, lessonId, courseId, score, xpEarned, timeSpentMs);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        // Network blip: queue the write for replay on reconnect and treat
        // the lesson as locally complete. The upsert is conflict-safe on
        // (user_id, lesson_id), so the replay is idempotent.
        await enqueue(user.id, {
          type: 'lesson-completion',
          payload: { lessonId, courseId, score, xpEarned, timeSpentMs },
        });
        completion = {
          id: `offline:${lessonId}`,
          userId: user.id,
          lessonId,
          courseId,
          score,
          xpEarned,
          timeSpentMs,
          completedAt: new Date().toISOString(),
        };
      }
      setState((prev) => {
        const newMap = new Map(prev.completions);
        newMap.set(lessonId, completion);
        return { ...prev, completions: newMap };
      });
    },
    [user?.id]
  );

  return {
    completions: state.completions,
    loading: state.loading,
    error,
    retry,
    getLessonState,
    getScore,
    markLessonComplete,
  };
}
