import { create } from 'zustand';
import type { UserProfile, DailyStats, Subscription } from '../types';
import { fetchProfile, fetchTodayStats, fetchSubscription, fetchReviewItemCount } from '../lib/supabase-queries';

interface AppState {
  profile: UserProfile | null;
  dailyStats: DailyStats | null;
  subscription: Subscription | null;
  reviewCount: number;
  loading: boolean;
  error: string | null;

  loadUserData: (userId: string) => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
  setDailyStats: (stats: DailyStats | null) => void;
  refreshSubscription: (userId: string) => Promise<void>;
  refreshReviewCount: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  profile: null,
  dailyStats: null,
  subscription: null,
  reviewCount: 0,
  loading: true,
  error: null,

  loadUserData: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const profile = await fetchProfile(userId);

      // Non-critical fetches — don't let them block profile loading
      const [dailyStats, subscription, reviewCount] = await Promise.all([
        fetchTodayStats(userId).catch(() => null),
        fetchSubscription(userId).catch(() => null),
        fetchReviewItemCount(userId).catch(() => 0),
      ]);

      set({ profile, dailyStats, subscription, reviewCount, loading: false });
    } catch (err) {
      // Only reaches here if fetchProfile itself fails
      const message = err instanceof Error ? err.message : 'Failed to load user data';
      console.error('loadUserData error:', message);
      set({ loading: false, error: message });
    }
  },

  setProfile: (profile) => set({ profile }),
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
    loading: true,
    error: null,
  }),
}));
