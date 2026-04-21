import { useCallback, useMemo } from 'react';
import { useSchoolStore } from '../stores/useSchoolStore';
import type { Assignment, AssignmentSubmission } from '../types';

type AssignmentWithSubmission = Assignment & { submission?: AssignmentSubmission };

interface GroupedAssignments {
  pending: AssignmentWithSubmission[];
  inProgress: AssignmentWithSubmission[];
  completed: AssignmentWithSubmission[];
  overdue: AssignmentWithSubmission[];
}

export function useStudentAssignments(userId: string | undefined) {
  const { pendingAssignments, loading } = useSchoolStore();

  const refresh = useCallback(async () => {
    if (!userId) return;
    await useSchoolStore.getState().loadStudentSchoolData(userId);
  }, [userId]);

  const grouped = useMemo((): GroupedAssignments => {
    const now = new Date().toISOString();
    const pending: AssignmentWithSubmission[] = [];
    const inProgress: AssignmentWithSubmission[] = [];
    const completed: AssignmentWithSubmission[] = [];
    const overdue: AssignmentWithSubmission[] = [];

    for (const assignment of pendingAssignments) {
      const status = assignment.submission?.status;

      if (status === 'submitted' || status === 'graded' || status === 'returned') {
        completed.push(assignment);
      } else if (status === 'in_progress') {
        inProgress.push(assignment);
      } else if (assignment.dueAt && assignment.dueAt < now && !assignment.lateSubmissionAllowed) {
        overdue.push(assignment);
      } else {
        pending.push(assignment);
      }
    }

    return { pending, inProgress, completed, overdue };
  }, [pendingAssignments]);

  return {
    all: pendingAssignments,
    ...grouped,
    loading,
    refresh,
  };
}
