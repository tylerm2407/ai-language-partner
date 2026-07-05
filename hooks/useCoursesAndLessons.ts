import { useState, useCallback, useRef } from 'react';
import {
  fetchCourses,
  fetchUnits,
  fetchLessons,
  fetchLessonWithExercises,
} from '../lib/supabase-queries';
import type { Course, Unit, Lesson } from '../types';

export function useCoursesAndLessons() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [units, setUnits] = useState<Record<string, Unit[]>>({});
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Remembers the most recent failed-able load so `retry` can re-run it.
  const lastAttemptRef = useRef<(() => Promise<unknown>) | null>(null);

  const loadCourses = useCallback(async (targetLanguage?: string) => {
    const attempt = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCourses(targetLanguage);
        setCourses(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load courses');
      } finally {
        setLoading(false);
      }
    };
    lastAttemptRef.current = attempt;
    await attempt();
  }, []);

  const loadUnits = useCallback(async (courseId: string): Promise<Unit[]> => {
    if (units[courseId]) return units[courseId];
    const attempt = async (): Promise<Unit[]> => {
      setError(null);
      try {
        const data = await fetchUnits(courseId);
        setUnits((prev) => ({ ...prev, [courseId]: data }));
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load units');
        return [];
      }
    };
    lastAttemptRef.current = attempt;
    return attempt();
  }, [units]);

  const loadLessons = useCallback(async (unitId: string): Promise<Lesson[]> => {
    if (lessons[unitId]) return lessons[unitId];
    const attempt = async (): Promise<Lesson[]> => {
      setError(null);
      try {
        const data = await fetchLessons(unitId);
        setLessons((prev) => ({ ...prev, [unitId]: data }));
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lessons');
        return [];
      }
    };
    lastAttemptRef.current = attempt;
    return attempt();
  }, [lessons]);

  const retry = useCallback(async () => {
    if (lastAttemptRef.current) {
      await lastAttemptRef.current();
    }
  }, []);

  const loadLessonWithExercises = useCallback(async (lessonId: string) => {
    return fetchLessonWithExercises(lessonId);
  }, []);

  return {
    courses,
    units,
    lessons,
    loading,
    error,
    retry,
    loadCourses,
    loadUnits,
    loadLessons,
    loadLessonWithExercises,
  };
}
