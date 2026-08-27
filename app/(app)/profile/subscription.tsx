import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore, effectiveTier } from '../../../stores/useAppStore';
import {
  getOfferingPackages,
  purchasePackage,
  restorePurchases,
  tierFromPackage,
  isMonthlyPackage,
  annualSavingsPercent,
  isPurchasesAvailable,
  reportPurchaseFailure,
} from '../../../lib/purchases';
import { PLAN_FEATURES, type PlanId } from '../../../lib/plans';
import { trackEvent } from '../../../lib/analytics';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../config/theme';
import { GlowLayer } from '../../../components/ui/GlowBackground';
import { TrialTimeline } from '../../../components/subscription/TrialTimeline';
import { PlanCard } from '../../../components/subscription/PlanCard';
import { trialDaysFromPeriod } from '../../../lib/trial-timeline';

// Manage/cancel deep links (App Store requires a path to manage the sub).
const MANAGE_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';

/**
 * Contrast effect (DESIGN.md §UX Psychology Principles #6): the brain scores a
 * price against whatever it saw immediately before, so the list leads with the
 * richest tier and its annual term. Every figure shown is the real store
 * price — the framing changes, the numbers do not.
 */
const DISPLAY_TIER_ORDER: PlanId[] = ['vip', 'premium', 'basic'];

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const { profile, subscription, entitledTier, refreshSubscription, setEntitledTier } = useAppStore();
  const router = useRouter();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [offeringsError, setOfferingsError] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Matches the paywall gate: the entitlement counts even before the webhook
  // has written the row, so "Current Plan" doesn't read "No subscription" to
  // someone who just paid.
  const currentTier = effectiveTier(subscription, entitledTier);

  const loadOfferings = useCallback(async () => {
    setLoadingOfferings(true);
    setOfferingsError(false);
    try {
      const pkgs = await getOfferingPackages();
      setPackages(pkgs);
      if (pkgs.length === 0) setOfferingsError(true);
    } catch {
      setOfferingsError(true);
    } finally {
      setLoadingOfferings(false);
    }
  }, []);

  useEffect(() => {
    loadOfferings();
    trackEvent('paywall_viewed', { currentTier });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadOfferings]);

  // Refresh server-side subscription state whenever the screen is focused.
  useFocusEffect(
    useCallback(() => {
      if (user) refreshSubscription(user.id);
    }, [user, refreshSubscription])
  );

  const handlePurchase = async (pkg: PurchasesPackage) => {
    if (!user) return;
    setPurchasingId(pkg.identifier);
    try {
      const result = await purchasePackage(pkg);
      if (result.status === 'success') {
        const tier = result.tier ?? tierFromPackage(pkg);
        trackEvent('purchase_completed', { tier });
        // Entitlement first — the RevenueCat webhook writes the server tier a
        // round-trip later (and not at all if it exhausts its five retries),
        // and the paywall gate must not hold a paying learner in the meantime.
        setEntitledTier(tier);
        await refreshSubscription(user.id);
        setTimeout(() => user && refreshSubscription(user.id), 2500);
        Alert.alert('You’re all set!', 'Your subscription is now active. Enjoy!');
      } else if (result.status === 'error') {
        reportPurchaseFailure('purchase', result.message, tierFromPackage(pkg), result.code);
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
      if (result.status === 'success') {
        if (result.tier && result.tier !== 'starter') setEntitledTier(result.tier);
        await refreshSubscription(user.id);
        setTimeout(() => user && refreshSubscription(user.id), 2500);
        if (result.tier && result.tier !== 'starter') {
          trackEvent('purchase_restored', { tier: result.tier });
          Alert.alert('Purchases restored', 'Your subscription has been restored.');
        } else {
          Alert.alert('No purchases found', 'We couldn’t find an active subscription to restore.');
        }
      } else {
        reportPurchaseFailure('restore', result.message, undefined, result.code);
        Alert.alert('Restore failed', result.message ?? 'Please try again.');
      }
    } finally {
      setRestoring(false);
    }
  };

  // Richest tier first, and the annual term ahead of the monthly one within
  // each tier, so the largest genuine figure sets the reference point.
  const sortedPackages = useMemo(
    () =>
      [...packages].sort((a, b) => {
        const ta = DISPLAY_TIER_ORDER.indexOf(tierFromPackage(a));
        const tb = DISPLAY_TIER_ORDER.indexOf(tierFromPackage(b));
        if (ta !== tb) return ta - tb;
        return b.product.price - a.product.price;
      }),
    [packages],
  );

  // The trial we would actually put the learner on: the cheapest package that
  // carries a free intro period. Derived from the live StoreKit product rather
  // than hard-coded, so the timeline can never claim a trial length or price
  // that differs from what the purchase sheet will charge.
  const trialOffer = useMemo(() => {
    let best: { days: number; priceString: string; price: number } | null = null;
    for (const pkg of packages) {
      const intro = pkg.product.introPrice;
      if (!intro || intro.price !== 0) continue;
      const days = trialDaysFromPeriod(intro.periodUnit, intro.periodNumberOfUnits);
      if (!days) continue;
      if (!best || pkg.product.price < best.price) {
        best = { days, priceString: pkg.product.priceString, price: pkg.product.price };
      }
    }
    return best;
  }, [packages]);

  // Real monthly price per tier — the basis for the annual saving figure.
  const monthlyPriceByTier = useMemo(() => {
    const byTier: Partial<Record<PlanId, number>> = {};
    for (const pkg of packages) {
      if (isMonthlyPackage(pkg)) byTier[tierFromPackage(pkg)] = pkg.product.price;
    }
    return byTier;
  }, [packages]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.surface.base }}>
      <GlowLayer />
      <View className="flex-row items-center px-4 py-3 border-b border-dark-border">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text className="text-lg font-semibold text-text-primary ml-3">Subscription</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="text-2xl font-bold text-text-primary mb-2">Choose Your Plan</Text>
        {/* Says what a paid plan actually buys. An earlier line led with
            "unlimited hearts" — a mechanic that has since been removed
            outright, because framing the product as selling relief from its own
            friction is the trap this tier list exists to avoid. */}
        <Text className="text-base text-text-secondary mb-6">
          Lessons, reviews and reading are free, always. Paid plans add daily
          tutor conversation, voice practice and writing feedback.
        </Text>

        {/* `starter` is the free plan — a real tier a learner can stay on
            indefinitely, not the absence of one. This card has said both things
            over time; what makes either version honest is naming the actual
            boundary rather than gesturing at it, so it lists what a free
            account gets and leaves the pitch to the rungs below. The list is
            PLAN_FEATURES.starter, so it cannot drift from lib/plans.ts. */}
        {currentTier === 'starter' && (
          <View className="rounded-2xl p-5 mb-4 border-2 border-border-subtle bg-dark-card">
            <Text className="text-2xl font-bold text-text-primary mb-1">Free plan</Text>
            <Text className="text-sm text-text-secondary mb-3">
              You can keep learning on this plan for as long as you like. What it includes:
            </Text>
            {PLAN_FEATURES.starter.map((feature) => (
              <Text key={feature} className="text-sm text-text-primary mb-1">
                · {feature}
              </Text>
            ))}
            <Text className="text-sm text-text-secondary mt-3">
              The AI tutor, voice practice and writing grades need a paid plan.
            </Text>
          </View>
        )}

        {/* Trial mechanics, stated before the prices rather than after the
            purchase. Only rendered when a real free trial exists on a live
            product. */}
        {currentTier === 'starter' && trialOffer && (
          <TrialTimeline trialDays={trialOffer.days} priceString={trialOffer.priceString} />
        )}

        {/* Current plan banner */}
        {currentTier !== 'starter' && (
          <View className="rounded-2xl p-4 mb-4 border-2 border-success bg-success-bg">
            <Badge variant="success" label="Current Plan" />
            <Text className="text-lg font-semibold text-text-primary mt-2 capitalize">{currentTier}</Text>
            {subscription?.currentPeriodEnd ? (
              <Text className="text-sm text-text-secondary mt-1">
                {subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'} on{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </Text>
            ) : null}
          </View>
        )}

        {!isPurchasesAvailable() ? (
          <View className="rounded-2xl p-5 mb-4 border border-dark-border bg-dark-card">
            <Text className="text-base text-text-secondary">
              Subscriptions are available in the App Store and Google Play builds of Fluenci.
            </Text>
          </View>
        ) : loadingOfferings ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color={colors.action.accent} />
          </View>
        ) : offeringsError ? (
          <View className="rounded-2xl p-5 mb-4 border border-dark-border bg-dark-card">
            <Text className="text-base text-text-primary mb-3">
              We couldn&apos;t load plans right now.
            </Text>
            <Button label="Try again" variant="secondary" onPress={loadOfferings} />
          </View>
        ) : (
          sortedPackages.map((pkg) => {
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
                disabled={purchasingId !== null || restoring}
              />
            );
          })
        )}

        {/* Restore Purchases — required by App Store for IAP apps */}
        {isPurchasesAvailable() && (
          <Pressable
            onPress={handleRestore}
            disabled={restoring || purchasingId !== null}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            className="py-3 items-center mt-2"
          >
            {restoring ? (
              <ActivityIndicator color={colors.text.secondary} />
            ) : (
              <Text className="text-base text-primary font-medium">Restore Purchases</Text>
            )}
          </Pressable>
        )}

        {/* Manage / cancel subscription */}
        {currentTier !== 'starter' && (
          <Pressable
            onPress={() => Linking.openURL(MANAGE_URL)}
            accessibilityRole="button"
            accessibilityLabel="Manage subscription"
            className="py-3 items-center"
          >
            <Text className="text-base text-text-secondary">Manage Subscription</Text>
          </Pressable>
        )}

        {/* Legal — App Store requires terms + privacy on the paywall */}
        <View className="flex-row flex-wrap justify-center gap-4 mt-4">
          <Pressable onPress={() => Linking.openURL('https://fluenci.com/terms')} accessibilityRole="link">
            <Text className="text-xs text-text-tertiary underline">Terms of Use</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://fluenci.com/privacy')} accessibilityRole="link">
            <Text className="text-xs text-text-tertiary underline">Privacy Policy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
