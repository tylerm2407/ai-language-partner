/**
 * Lesson progress for a course — a view over the shared completions store.
 *
 * The state itself lives in stores/useLessonProgressStore so that marking a
 * lesson complete on the lesson screen is immediately visible to the Learn
 * tab's carousel and the home-screen tiles. See that file for why per-hook
 * state was the bug behind "I finished a lesson and stayed in the same place".
 *
 * `courseId` no longer scopes the fetch (the store holds every course's
 * completions and lesson ids are unique), it is only kept so callers read the
 * same way as before and so the returned `completions` map can be scoped.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useLessonProgressStore } from '../stores/useLessonProgressStore';
import type { LessonCompletion } from '../types';

export type LessonState = 'completed' | 'active' | 'locked';

export function useLessonProgress(courseId?: string) {
  const { user } = useAuth();
  const userId = user?.id;

  const allCompletions = useLessonProgressStore((s) => s.completions);
  const loading = useLessonProgressStore((s) => s.loading);
  const error = useLessonProgressStore((s) => s.error);
  const load = useLessonProgressStore((s) => s.load);
  const refresh = useLessonProgressStore((s) => s.refresh);
  const markComplete = useLessonProgressStore((s) => s.markComplete);

  useEffect(() => {
    if (!userId) return;
    load(userId);
  }, [userId, load]);

  const completions = useMemo(() => {
    if (!courseId) return allCompletions;
    const scoped = new Map<string, LessonCompletion>();
    for (const [lessonId, completion] of allCompletions) {
      if (completion.courseId === courseId) scoped.set(lessonId, completion);
    }
    return scoped;
  }, [allCompletions, courseId]);

  const retry = useCallback(() => {
    if (!userId) return;
    refresh(userId);
  }, [userId, refresh]);

  const getLessonState = useCallback(
    (lessonId: string, orderedLessonIds: string[]): LessonState => {
      // Read the unscoped map: a completion written before course_id was
      // resolvable must still unlock the lesson that follows it.
      if (allCompletions.has(lessonId)) return 'completed';
      const idx = orderedLessonIds.indexOf(lessonId);
      if (idx === 0) return 'active';
      // Active if previous lesson is completed
      if (idx > 0 && allCompletions.has(orderedLessonIds[idx - 1])) return 'active';
      return 'locked';
    },
    [allCompletions],
  );

  const getScore = useCallback(
    (lessonId: string): number | null => allCompletions.get(lessonId)?.score ?? null,
    [allCompletions],
  );

  /**
   * Record a finished lesson. Resolves once the completion is durable —
   * either in Postgres or in the replay queue — and returns which of the two,
   * so the caller can tell the learner it will sync. Rejects only if the
   * lesson can't be identified.
   */
  const markLessonComplete = useCallback(
    async (
      lessonId: string,
      courseIdForLesson: string,
      score: number,
      xpEarned: number,
      timeSpentMs: number,
    ) => {
      if (!userId) throw new Error('Cannot record a lesson completion while signed out');
      if (!courseIdForLesson) {
        // course_id is NOT NULL in the table; the old call site passed '' when
        // the lesson's course couldn't be resolved, which made Postgres reject
        // the row with a uuid parse error that was then swallowed.
        throw new Error(`Lesson ${lessonId} has no course; cannot record completion`);
      }
      return markComplete(userId, lessonId, courseIdForLesson, score, xpEarned, timeSpentMs);
    },
    [userId, markComplete],
  );

  return {
    completions,
    loading,
    error,
    retry,
    refresh: retry,
    getLessonState,
    getScore,
    markLessonComplete,
  };
}
