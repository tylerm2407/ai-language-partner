import { useState, useCallback } from 'react';
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

  const loadCourses = useCallback(async (targetLanguage?: string) => {
    setLoading(true);
    try {
      const data = await fetchCourses(targetLanguage);
      setCourses(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnits = useCallback(async (courseId: string) => {
    if (units[courseId]) return units[courseId];
    const data = await fetchUnits(courseId);
    setUnits((prev) => ({ ...prev, [courseId]: data }));
    return data;
  }, [units]);

  const loadLessons = useCallback(async (unitId: string) => {
    if (lessons[unitId]) return lessons[unitId];
    const data = await fetchLessons(unitId);
    setLessons((prev) => ({ ...prev, [unitId]: data }));
    return data;
  }, [lessons]);

  const loadLessonWithExercises = useCallback(async (lessonId: string) => {
    return fetchLessonWithExercises(lessonId);
  }, []);

  return {
    courses,
    units,
    lessons,
    loading,
    loadCourses,
    loadUnits,
    loadLessons,
    loadLessonWithExercises,
  };
}
