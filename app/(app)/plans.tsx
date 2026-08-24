/**
 * Post-signup paywall.
 *
 * Deliberately NOT part of `(public)/onboarding` even though it is the last
 * beat of onboarding for the learner. That flow runs before sign-up, so
 * RevenueCat would still be on an anonymous id: `revenuecat-webhook` drops any
 * event whose `app_user_id` is not a UUID (index.ts:108) and ignores the
 * TRANSFER that a later logIn produces (index.ts:114). A purchase made there
 * would unlock the client and never reach `subscriptions`, leaving the server
 * enforcing free-tier quotas on a paying learner. Here the account exists, so
 * `configurePurchases` has already run with a real user id.
 *
 * Skippable by design: Fluenci has a real free tier, and a paywall with no way
 * past it invites a 3.1.1 rejection.
 *
 * Fires AFTER the learner's first completed lesson, not at account creation —
 * see app/(app)/learn/[lessonId].tsx. The constraint above is unchanged by
 * that move: later is still post-signup. It reached this screen from
 * onboarding with a `lessonId` to hand off to; there is no such param now,
 * because the lesson has already happened and Home sits beneath this screen.
 */
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect, useMemo } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../stores/useAppStore';
import {
  getOfferingPackages,
  purchasePackage,
  restorePurchases,
  tierFromPackage,
  isAnnualPackage,
  isMonthlyPackage,
  annualSavingsPercent,
  isPurchasesAvailable,
} from '../../lib/purchases';
import { type PlanId } from '../../lib/plans';
import { trackEvent } from '../../lib/analytics';
import { PlanCard } from '../../components/subscription/PlanCard';
import { TermToggle, type BillingTerm } from '../../components/subscription/TermToggle';
import { colors } from '../../config/theme';
import { GlowLayer } from '../../components/ui/GlowBackground';

/** Richest tier first so the largest genuine figure sets the reference point. */
const DISPLAY_TIER_ORDER: PlanId[] = ['vip', 'premium', 'basic'];

export default function PlansScreen() {
  const { user } = useAuth();
  const { subscription, refreshSubscription } = useAppStore();
  const router = useRouter();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState<BillingTerm>('annual');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const currentTier = subscription?.tier ?? 'starter';

  /**
   * Leave for the first lesson. This screen sits directly on top of Home, so
   * replacing it keeps Home beneath the lesson — `LessonRunner`'s exit is
   * `router.back()` and would do nothing with an empty stack.
   */
  const proceed = useCallback(() => {
    // The paywall no longer hands off into a lesson — it now runs *after* the
    // first one, so there is nothing to forward to. Dismissing it lands the
    // learner on Home, which is already beneath it in the stack.
    if (router.canGoBack()) {
      // Home is already beneath us; going back avoids stacking a second copy.
      router.back();
    } else {
      router.replace('/(app)');
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pkgs = await getOfferingPackages();
        if (!cancelled) setPackages(pkgs);
      } catch (err) {
        // Never trap a new learner behind a paywall that failed to load — the
        // screen falls through to its skip path instead.
        console.error('[plans] offerings failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    trackEvent('paywall_viewed', { source: 'onboarding', currentTier });
  }, [currentTier]);

  const monthlyPriceByTier = useMemo(() => {
    const byTier: Partial<Record<PlanId, number>> = {};
    for (const pkg of packages) {
      if (isMonthlyPackage(pkg)) byTier[tierFromPackage(pkg)] = pkg.product.price;
    }
    return byTier;
  }, [packages]);

  const visible = useMemo(() => {
    const wantAnnual = term === 'annual';
    return packages
      .filter((p) => (wantAnnual ? isAnnualPackage(p) : isMonthlyPackage(p)))
      .sort(
        (a, b) =>
          DISPLAY_TIER_ORDER.indexOf(tierFromPackage(a)) -
          DISPLAY_TIER_ORDER.indexOf(tierFromPackage(b)),
      );
  }, [packages, term]);

  /** Best annual saving on offer — drives the toggle's badge. */
  const bestSavings = useMemo(() => {
    let best = 0;
    for (const pkg of packages) {
      if (!isAnnualPackage(pkg)) continue;
      best = Math.max(best, annualSavingsPercent(pkg.product.price, monthlyPriceByTier[tierFromPackage(pkg)]));
    }
    return best;
  }, [packages, monthlyPriceByTier]);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    if (!user) return;
    setPurchasingId(pkg.identifier);
    try {
      const result = await purchasePackage(pkg);
      if (result.status === 'success') {
        trackEvent('purchase_completed', { tier: result.tier ?? tierFromPackage(pkg) });
        await refreshSubscription(user.id);
        setTimeout(() => user && refreshSubscription(user.id), 2500);
        proceed();
      } else if (result.status === 'error') {
        Alert.alert('Purchase failed', result.message ?? 'Please try again.');
      }
      // 'cancelled' — silent, expected.
    } finally {
      setPurchasingId(null);
    }
  };

  const handleRestore = async () => {
    if (!user) return;
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.status === 'success' && result.tier && result.tier !== 'starter') {
        trackEvent('purchase_restored', { tier: result.tier });
        await refreshSubscription(user.id);
        proceed();
      } else {
        Alert.alert('No purchases found', 'We couldn’t find an active subscription to restore.');
      }
    } finally {
      setRestoring(false);
    }
  };

  const busy = purchasingId !== null || restoring;
  const showPlans = isPurchasesAvailable() && visible.length > 0;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.surface.base }}>
      <GlowLayer />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text className="text-3xl font-bold text-text-primary mb-2">Choose your plan</Text>
        <Text className="text-base text-text-secondary mb-6">
          Every plan starts with 7 days free. Lessons, reviews and reading stay unlimited on
          Fluenci Free — paid plans raise your daily AI tutor, voice and writing limits.
        </Text>

        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color={colors.action.accent} />
          </View>
        ) : showPlans ? (
          <>
            <TermToggle term={term} onChange={setTerm} savingsPct={bestSavings} />
            {visible.map((pkg) => {
              const tier = tierFromPackage(pkg);
              return (
                <PlanCard
                  key={pkg.identifier}
                  pkg={pkg}
                  tier={tier}
                  isCurrentPlan={tier === currentTier}
                  isPopular={tier === 'premium'}
                  savingsPct={annualSavingsPercent(pkg.product.price, monthlyPriceByTier[tier])}
                  onPurchase={() => handlePurchase(pkg)}
                  loading={purchasingId === pkg.identifier}
                  disabled={busy}
                  ctaLabel="Start free trial"
                />
              );
            })}
          </>
        ) : (
          // Plans unavailable — say so plainly and let the learner get on with
          // the lesson rather than staring at a retry that cannot help.
          <View className="rounded-2xl p-5 mb-4 border border-dark-border bg-dark-card">
            <Text className="text-base text-text-secondary">
              Plans aren’t available right now. You can upgrade any time from your profile.
            </Text>
          </View>
        )}

        <Pressable
          onPress={proceed}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Continue with the free plan"
          className="items-center py-4 min-h-[44px]"
        >
          <Text className="text-base font-semibold text-text-secondary">Continue with Free</Text>
        </Pressable>

        {showPlans && (
          <Pressable
            onPress={handleRestore}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            className="items-center py-3 min-h-[44px]"
          >
            <Text className="text-sm text-text-tertiary">
              {restoring ? 'Restoring…' : 'Restore purchases'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
