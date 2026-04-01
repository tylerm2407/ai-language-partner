import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { fetchLessonCompletions, upsertLessonCompletion } from '../lib/supabase-queries';
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

  useEffect(() => {
    if (!user?.id) return;
    fetchLessonCompletions(user.id, courseId)
      .then((data) => {
        const map = new Map<string, LessonCompletion>();
        for (const c of data) {
          map.set(c.lessonId, c);
        }
        setState({ completions: map, loading: false });
      })
      .catch(() => setState((prev) => ({ ...prev, loading: false })));
  }, [user?.id, courseId]);

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
      const completion = await upsertLessonCompletion(user.id, lessonId, courseId, score, xpEarned, timeSpentMs);
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
    getLessonState,
    getScore,
    markLessonComplete,
  };
}
