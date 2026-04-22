import { create } from 'zustand';
import type { UserProfile, DailyStats, Subscription, MotivationReason } from '../types';
import { fetchProfile, fetchTodayStats, fetchSubscription, fetchReviewItemCount, fetchUserRoles } from '../lib/supabase-queries';

interface AppState {
  profile: UserProfile | null;
  dailyStats: DailyStats | null;
  subscription: Subscription | null;
  reviewCount: number;
  roles: string[];
  loading: boolean;
  error: string | null;
  /** Transient, not persisted. Captured during onboarding, consumed by HeroHook copy. */
  motivation: MotivationReason | null;

  loadUserData: (userId: string) => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
  setDailyStats: (stats: DailyStats | null) => void;
  setMotivation: (motivation: MotivationReason | null) => void;
  refreshSubscription: (userId: string) => Promise<void>;
  refreshReviewCount: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  profile: null,
  dailyStats: null,
  subscription: null,
  reviewCount: 0,
  roles: [],
  loading: true,
  error: null,
  motivation: null,

  loadUserData: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const profile = await fetchProfile(userId);

      // Non-critical fetches — don't let them block profile loading
      const [dailyStats, subscription, reviewCount, roles] = await Promise.all([
        fetchTodayStats(userId).catch(() => null),
        fetchSubscription(userId).catch(() => null),
        fetchReviewItemCount(userId).catch(() => 0),
        fetchUserRoles(userId).catch(() => [] as string[]),
      ]);

      set({ profile, dailyStats, subscription, reviewCount, roles, loading: false });
    } catch (err) {
      // Only reaches here if fetchProfile itself fails
      const message = err instanceof Error ? err.message : 'Failed to load user data';
      console.error('loadUserData error:', message);
      set({ loading: false, error: message });
    }
  },

  setProfile: (profile) => set({ profile }),
  setDailyStats: (dailyStats) => set({ dailyStats }),
  setMotivation: (motivation) => set({ motivation }),

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
    loading: true,
    error: null,
    motivation: null,
  }),
}));
