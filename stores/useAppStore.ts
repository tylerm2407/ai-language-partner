import { create } from 'zustand';
import type { UserProfile, DailyStats, Subscription } from '../types';
import { fetchProfile, fetchTodayStats, fetchSubscription, fetchReviewItemCount, fetchUserRoles, fetchHasCompletedLesson } from '../lib/supabase-queries';

interface AppState {
  profile: UserProfile | null;
  dailyStats: DailyStats | null;
  subscription: Subscription | null;
  reviewCount: number;
  roles: string[];
  /** Lifetime flag — has this learner ever finished a lesson? Gates the hard
   *  paywall in app/(app)/_layout.tsx, which lets the first lesson through
   *  free and closes afterwards. Deliberately NOT dailyStats.lessonsCompleted,
   *  which resets every night and would reopen the gate each morning. */
  hasCompletedLesson: boolean;
  loading: boolean;
  error: string | null;

  loadUserData: (userId: string) => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
  setDailyStats: (stats: DailyStats | null) => void;
  refreshSubscription: (userId: string) => Promise<void>;
  /** Flip the paywall gate the instant a lesson completes, without a refetch. */
  setHasCompletedLesson: (value: boolean) => void;
  refreshReviewCount: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  profile: null,
  dailyStats: null,
  subscription: null,
  reviewCount: 0,
  roles: [],
  hasCompletedLesson: false,
  loading: true,
  error: null,

  loadUserData: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const profile = await fetchProfile(userId);

      // Non-critical fetches — don't let them block profile loading
      const [dailyStats, subscription, reviewCount, roles, hasCompletedLesson] = await Promise.all([
        fetchTodayStats(userId).catch(() => null),
        fetchSubscription(userId).catch(() => null),
        fetchReviewItemCount(userId).catch(() => 0),
        fetchUserRoles(userId).catch(() => [] as string[]),
        // Fail OPEN: if this read fails we treat the learner as still owed
        // their first lesson rather than locking them out of the app on a
        // transient error. The server-side quota zeros still hold the line.
        fetchHasCompletedLesson(userId).catch(() => false),
      ]);

      set({ profile, dailyStats, subscription, reviewCount, roles, hasCompletedLesson, loading: false });
    } catch (err) {
      // Only reaches here if fetchProfile itself fails
      const message = err instanceof Error ? err.message : 'Failed to load user data';
      console.error('loadUserData error:', message);
      set({ loading: false, error: message });
    }
  },

  setProfile: (profile) => set({ profile }),
  setHasCompletedLesson: (hasCompletedLesson) => set({ hasCompletedLesson }),
  setDailyStats: (dailyStats) => set({ dailyStats }),

  refreshSubscription: async (userId: string) => {
    try {
      const subscription = await fetchSubscription(userId);
      set({ subscription });
    } catch (err) {
      console.error('refreshSubscription error:', err);
    }
  },

  refreshReviewCount: async (userId: string) => {
    try {
      const reviewCount = await fetchReviewItemCount(userId);
      set({ reviewCount });
    } catch (err) {
      console.error('refreshReviewCount error:', err);
    }
  },

  reset: () => set({
    profile: null,
    dailyStats: null,
    subscription: null,
    reviewCount: 0,
    roles: [],
    hasCompletedLesson: false,
    loading: true,
    error: null,
  }),
}));
