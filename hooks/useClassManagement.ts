import { useState, useCallback } from 'react';
import { useSchoolStore } from '../stores/useSchoolStore';
import {
  createClassroom,
  callSchoolAction,
  fetchTeacherClassrooms,
} from '../lib/supabase-queries';
import type { Classroom } from '../types';

export function useClassManagement(userId: string | undefined) {
  const { classrooms, organization } = useSchoolStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshClasses = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await fetchTeacherClassrooms(userId);
      useSchoolStore.setState({ classrooms: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh classes';
      setError(message);
      console.error('refreshClasses error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const createClass = useCallback(
    async (data: { name: string; targetLanguage: string; level: string }): Promise<Classroom | null> => {
      if (!organization) {
        setError('No organization found');
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const classroom = await createClassroom({
          ...data,
          organizationId: organization.id,
        });
        // Refresh the list
        await refreshClasses();
        return classroom;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create classroom';
        setError(message);
        console.error('createClass error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [organization, refreshClasses]
  );

  const archiveClass = useCallback(
    async (classroomId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        await callSchoolAction('archive_classroom', { classroomId });
        await refreshClasses();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to archive classroom';
        setError(message);
        console.error('archiveClass error:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [refreshClasses]
  );

  const regenerateInviteCode = useCallback(
    async (classroomId: string): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await callSchoolAction('regenerate_invite_code', { classroomId });
        await refreshClasses();
        return result.inviteCode as string;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to regenerate invite code';
        setError(message);
        console.error('regenerateInviteCode error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [refreshClasses]
  );

  const removeStudent = useCallback(
    async (classroomId: string, studentId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        await callSchoolAction('remove_student', { classroomId, studentId });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove student';
        setError(message);
        console.error('removeStudent error:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    classrooms,
    loading,
    error,
    createClass,
    refreshClasses,
    archiveClass,
    regenerateInviteCode,
    removeStudent,
  };
}
