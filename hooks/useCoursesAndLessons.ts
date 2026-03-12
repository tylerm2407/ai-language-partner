import { useEffect, useState, useCallback } from 'react';
import {
  fetchCourses,
  fetchUnits,
  fetchLessons,
  fetchLessonWithExercises,
} from '../lib/supabase-queries';
import type { Course, Unit, Lesson } from '../types';

interface UseCoursesReturn {
  courses: Course[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCourses(targetLanguage?: string): UseCoursesReturn {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchCourses(targetLanguage);
      setCourses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load courses');
    } finally {
      setIsLoading(false);
    }
  }, [targetLanguage]);

  useEffect(() => {
    load();
  }, [load]);

  return { courses, isLoading, error, refresh: load };
}

interface UseUnitsReturn {
  units: Unit[];
  isLoading: boolean;
  error: string | null;
}

export function useUnits(courseId: string | null): UseUnitsReturn {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setUnits([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchUnits(courseId);
        if (!cancelled) setUnits(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load units');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return { units, isLoading, error };
}

interface UseLessonsReturn {
  lessons: Lesson[];
  isLoading: boolean;
  error: string | null;
}

export function useLessons(unitId: string | null): UseLessonsReturn {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unitId) {
      setLessons([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchLessons(unitId);
        if (!cancelled) setLessons(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load lessons');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [unitId]);

  return { lessons, isLoading, error };
}

interface UseLessonDetailReturn {
  lesson: Lesson | null;
  isLoading: boolean;
  error: string | null;
}

export function useLessonDetail(lessonId: string | null): UseLessonDetailReturn {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId) {
      setLesson(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchLessonWithExercises(lessonId);
        if (!cancelled) setLesson(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load lesson');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  return { lesson, isLoading, error };
}
