import { create } from 'zustand';
import type { Organization, Classroom, ClassEnrollment, Assignment, AssignmentSubmission } from '../types';
import {
  fetchUserRoles,
  fetchTeacherClassrooms,
  fetchTeacherOrganization,
  fetchStudentEnrollments,
  fetchStudentAssignments,
} from '../lib/supabase-queries';

interface SchoolState {
  roles: string[];
  organization: Organization | null;
  classrooms: Classroom[];
  enrolledClasses: ClassEnrollment[];
  pendingAssignments: (Assignment & { submission?: AssignmentSubmission })[];
  activeRole: 'learner' | 'teacher';
  loading: boolean;

  loadRoles: (userId: string) => Promise<string[]>;
  loadTeacherData: (userId: string) => Promise<void>;
  loadStudentSchoolData: (userId: string) => Promise<void>;
  setActiveRole: (role: 'learner' | 'teacher') => void;
  reset: () => void;
}

export const useSchoolStore = create<SchoolState>((set, get) => ({
  roles: [],
  organization: null,
  classrooms: [],
  enrolledClasses: [],
  pendingAssignments: [],
  activeRole: 'learner',
  loading: false,

  loadRoles: async (userId) => {
    const roles = await fetchUserRoles(userId);
    set({ roles });
    return roles;
  },

  loadTeacherData: async (userId) => {
    set({ loading: true });
    try {
      const [org, classrooms] = await Promise.all([
        fetchTeacherOrganization(userId),
        fetchTeacherClassrooms(userId),
      ]);
      set({ organization: org, classrooms, loading: false });
    } catch (err) {
      console.error('loadTeacherData error:', err);
      set({ loading: false });
    }
  },

  loadStudentSchoolData: async (userId) => {
    set({ loading: true });
    try {
      const [enrollments, assignments] = await Promise.all([
        fetchStudentEnrollments(userId),
        fetchStudentAssignments(userId),
      ]);
      set({
        enrolledClasses: enrollments,
        pendingAssignments: assignments,
        loading: false,
      });
    } catch (err) {
      console.error('loadStudentSchoolData error:', err);
      set({ loading: false });
    }
  },

  setActiveRole: (role) => set({ activeRole: role }),

  reset: () => set({
    roles: [],
    organization: null,
    classrooms: [],
    enrolledClasses: [],
    pendingAssignments: [],
    activeRole: 'learner',
    loading: false,
  }),
}));
