import { create } from 'zustand';
import type { UserProfile, DailyStats, Subscription, SubscriptionTier } from '../types';
import { fetchProfile, fetchTodayStats, fetchSubscription, fetchReviewItemCount, fetchUserRoles, fetchHasCompletedLesson, fetchHasAiConversation } from '../lib/supabase-queries';

/**
 * In-flight review-count refreshes, keyed by user. Module scope rather than
 * store state on purpose: it is plumbing, not something any screen renders,
 * and putting it in the store would re-render every subscriber twice per call.
 */
const reviewCountInFlight = new Map<string, Promise<void>>();

/** Tier ladder, weakest first — index doubles as rank for `effectiveTier`. */
const TIER_RANK: SubscriptionTier[] = ['starter', 'basic', 'premium', 'vip'];

/**
 * The tier the app should actually gate on.
 *
 * Two sources disagree by design, and the answer is "whichever grants more":
 *
 *   - `subscription.tier` is the durable server record, written only by the
 *     revenuecat-webhook function. It is authoritative for quota enforcement
 *     (get_effective_limits reads the same row) but it lags a purchase by a
 *     webhook round-trip, and RevenueCat gives up after five retries.
 *   - `entitledTier` is what the RevenueCat SDK says this device is entitled
 *     to right now. Instant, offline-cached, and correct the moment the store
 *     confirms — but local to the device.
 *
 * Taking the max means a paid learner is never locked out while the webhook is
 * in flight or lost, and a learner whose row says `vip` is not downgraded just
 * because the SDK hasn't finished waking up. It cannot be used to *grant*
 * server-side quota: the edge functions read the row, not this.
 */
export function effectiveTier(
  subscription: Subscription | null,
  entitledTier: SubscriptionTier | null,
): SubscriptionTier {
  const a = TIER_RANK.indexOf(subscription?.tier ?? 'starter');
  const b = TIER_RANK.indexOf(entitledTier ?? 'starter');
  return TIER_RANK[Math.max(a === -1 ? 0 : a, b === -1 ? 0 : b)];
}

interface AppState {
  profile: UserProfile | null;
  dailyStats: DailyStats | null;
  subscription: Subscription | null;
  /** Live RevenueCat entitlement for this device. See `effectiveTier`. */
  entitledTier: SubscriptionTier | null;
  reviewCount: number;
  roles: string[];
  /** Lifetime flag — has this learner ever finished a lesson? Gates the hard
   *  paywall in app/(app)/_layout.tsx, which lets the first lesson through
   *  free and closes afterwards. Deliberately NOT dailyStats.lessonsCompleted,
   *  which resets every night and would reopen the gate each morning. */
  hasCompletedLesson: boolean;
  /** Raw signals for the onboarding reconciliation pass (hooks/
   *  useOnboardingReconciliation.ts). `null` = the read failed, which the
   *  reconciler treats as "unknown" and therefore as "change nothing".
   *
   *  They ride along in `loadUserData`'s existing Promise.all, so
   *  reconciliation costs no extra round trip. `hasCompletedLessonSignal` is
   *  deliberately separate from `hasCompletedLesson` above: the paywall wants
   *  a fail-OPEN boolean, the reconciler wants to know the read failed. */
  hasCompletedLessonSignal: boolean | null;
  hasAiConversationSignal: boolean | null;
  /** The user whose checklist has already been reconciled this app session. */
  reconciledUserId: string | null;
  loading: boolean;
  error: string | null;

  loadUserData: (userId: string) => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
  setDailyStats: (stats: DailyStats | null) => void;
  refreshSubscription: (userId: string) => Promise<void>;
  /** Record the device's live RevenueCat entitlement (never downgrades to
   *  `starter` silently — an expiry must come from the server row). */
  setEntitledTier: (tier: SubscriptionTier | null) => void;
  /** Flip the paywall gate the instant a lesson completes, without a refetch. */
  setHasCompletedLesson: (value: boolean) => void;
  /** Record that the onboarding checklist has been reconciled for this user. */
  setReconciled: (userId: string) => void;
  refreshReviewCount: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  profile: null,
  dailyStats: null,
  subscription: null,
  entitledTier: null,
  reviewCount: 0,
  roles: [],
  hasCompletedLesson: false,
  hasCompletedLessonSignal: null,
  hasAiConversationSignal: null,
  reconciledUserId: null,
  loading: true,
  error: null,

  loadUserData: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const profile = await fetchProfile(userId);

      // Non-critical fetches — don't let them block profile loading
      const [dailyStats, subscription, reviewCount, roles, hasCompletedLessonSignal, hasAiConversationSignal] = await Promise.all([
        fetchTodayStats(userId).catch(() => null),
        fetchSubscription(userId).catch(() => null),
        fetchReviewItemCount(userId).catch(() => 0),
        fetchUserRoles(userId).catch(() => [] as string[]),
        // `null` on failure so the onboarding reconciler can tell "no lesson"
        // from "we don't know" and leave the checklist alone. The paywall gate
        // below still coerces to false — see `hasCompletedLesson`.
        fetchHasCompletedLesson(userId).catch(() => null),
        fetchHasAiConversation().catch(() => null),
      ]);

      set({
        profile,
        dailyStats,
        subscription,
        reviewCount,
        roles,
        // Fail OPEN: if the read failed we treat the learner as still owed
        // their first lesson rather than locking them out of the app on a
        // transient error. The server-side quota zeros still hold the line.
        hasCompletedLesson: hasCompletedLessonSignal ?? false,
        hasCompletedLessonSignal,
        hasAiConversationSignal,
        loading: false,
      });
    } catch (err) {
      // Only reaches here if fetchProfile itself fails
      const message = err instanceof Error ? err.message : 'Failed to load user data';
      console.error('loadUserData error:', message);
      set({ loading: false, error: message });
    }
  },

  setProfile: (profile) => set({ profile }),
  setHasCompletedLesson: (hasCompletedLesson) => set({ hasCompletedLesson }),
  setReconciled: (reconciledUserId) => set({ reconciledUserId }),
  setDailyStats: (dailyStats) => set({ dailyStats }),

  refreshSubscription: async (userId: string) => {
    try {
      const subscription = await fetchSubscription(userId);
      set({ subscription });
    } catch (err) {
      console.error('refreshSubscription error:', err);
    }
  },

  setEntitledTier: (tier: SubscriptionTier | null) => set({ entitledTier: tier }),

  refreshReviewCount: async (userId: string) => {
    // Single-flight per user. This is called on every focus of Home and the
    // learn page as well as after each review submit, so tab-flicking would
    // otherwise fire a burst of identical count queries whose replies can also
    // land out of order — the older one winning and re-showing a cleared badge.
    const inFlight = reviewCountInFlight.get(userId);
    if (inFlight) return inFlight;

    const pending = (async () => {
      try {
        const reviewCount = await fetchReviewItemCount(userId);
        set({ reviewCount });
      } catch (err) {
        // Keep the previous count: a stale badge beats one that claims "all
        // caught up" because the network blipped.
        console.error('refreshReviewCount error:', err);
      } finally {
        reviewCountInFlight.delete(userId);
      }
    })();

    reviewCountInFlight.set(userId, pending);
    return pending;
  },

  reset: () => set({
    profile: null,
    dailyStats: null,
    subscription: null,
    entitledTier: null,
    reviewCount: 0,
    roles: [],
    hasCompletedLesson: false,
    hasCompletedLessonSignal: null,
    hasAiConversationSignal: null,
    reconciledUserId: null,
    loading: true,
    error: null,
  }),
}));
