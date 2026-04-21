import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSchoolStore } from '../stores/useSchoolStore';
import {
  fetchClassroomStudents,
  fetchClassroomAssignments,
  fetchAssignmentSubmissions,
} from '../lib/supabase-queries';
import type { Assignment, AssignmentSubmission } from '../types';

interface DashboardStats {
  totalStudents: number;
  pendingSubmissions: number;
  averageCompletionRate: number;
  upcomingAssignments: Assignment[];
  recentSubmissions: AssignmentSubmission[];
}

export function useTeacherDashboard(userId: string | undefined) {
  const { classrooms, loading: storeLoading } = useSchoolStore();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    pendingSubmissions: 0,
    averageCompletionRate: 0,
    upcomingAssignments: [],
    recentSubmissions: [],
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId || classrooms.length === 0) return;
    setLoading(true);
    try {
      // Fetch students for all classrooms in parallel
      const studentCounts = await Promise.all(
        classrooms.map((c) => fetchClassroomStudents(c.id).then((s) => s.length).catch(() => 0))
      );
      const totalStudents = studentCounts.reduce((sum, count) => sum + count, 0);

      // Fetch assignments for all classrooms in parallel
      const allAssignmentArrays = await Promise.all(
        classrooms.map((c) => fetchClassroomAssignments(c.id).catch(() => []))
      );
      const allAssignments = allAssignmentArrays.flat();

      // Upcoming: published assignments with a future due date
      const now = new Date().toISOString();
      const upcomingAssignments = allAssignments
        .filter((a) => a.status === 'published' && a.dueAt && a.dueAt > now)
        .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
        .slice(0, 5);

      // Fetch submissions for published assignments to compute pending count
      const publishedIds = allAssignments
        .filter((a) => a.status === 'published')
        .map((a) => a.id);

      let pendingSubmissions = 0;
      let totalCompletionRate = 0;
      let assignmentsWithSubmissions = 0;
      const recentSubmissions: AssignmentSubmission[] = [];

      if (publishedIds.length > 0) {
        const submissionArrays = await Promise.all(
          publishedIds.slice(0, 20).map((id) => fetchAssignmentSubmissions(id).catch(() => []))
        );

        for (const subs of submissionArrays) {
          const submitted = subs.filter((s) => s.status === 'submitted');
          pendingSubmissions += submitted.length;

          if (subs.length > 0) {
            const completedCount = subs.filter(
              (s) => s.status === 'graded' || s.status === 'returned'
            ).length;
            totalCompletionRate += completedCount / subs.length;
            assignmentsWithSubmissions++;
          }

          recentSubmissions.push(...subs);
        }
      }

      const averageCompletionRate =
        assignmentsWithSubmissions > 0 ? totalCompletionRate / assignmentsWithSubmissions : 0;

      // Sort recent submissions by submittedAt descending, take top 10
      recentSubmissions.sort((a, b) =>
        (b.submittedAt ?? b.startedAt ?? '').localeCompare(a.submittedAt ?? a.startedAt ?? '')
      );

      setStats({
        totalStudents,
        pendingSubmissions,
        averageCompletionRate,
        upcomingAssignments,
        recentSubmissions: recentSubmissions.slice(0, 10),
      });
    } catch (err) {
      console.error('useTeacherDashboard refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, classrooms]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...stats,
    loading: loading || storeLoading,
    refresh,
  };
}
