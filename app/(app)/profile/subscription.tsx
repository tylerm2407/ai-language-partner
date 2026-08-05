import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import {
  getOfferingPackages,
  purchasePackage,
  restorePurchases,
  tierFromPackage,
  isPurchasesAvailable,
} from '../../../lib/purchases';
import { PLAN_FEATURES, type PlanId } from '../../../lib/plans';
import { trackEvent } from '../../../lib/analytics';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../config/theme';
import { GlowLayer } from '../../../components/ui/GlowBackground';

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
  const { profile, subscription, refreshSubscription } = useAppStore();
  const router = useRouter();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [offeringsError, setOfferingsError] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const currentTier = subscription?.tier ?? 'starter';

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
        trackEvent('purchase_completed', { tier: result.tier ?? tierFromPackage(pkg) });
        // RevenueCat webhook updates the server tier within seconds; poll a
        // couple of times so the UI reflects it without a manual refresh.
        await refreshSubscription(user.id);
        setTimeout(() => user && refreshSubscription(user.id), 2500);
        Alert.alert('You’re all set!', 'Your subscription is now active. Enjoy!');
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
      if (result.status === 'success') {
        await refreshSubscription(user.id);
        setTimeout(() => user && refreshSubscription(user.id), 2500);
        if (result.tier && result.tier !== 'starter') {
          trackEvent('purchase_restored', { tier: result.tier });
          Alert.alert('Purchases restored', 'Your subscription has been restored.');
        } else {
          Alert.alert('No purchases found', 'We couldn’t find an active subscription to restore.');
        }
      } else {
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

  // Real monthly price per tier — the basis for the annual saving figure.
  const monthlyPriceByTier = useMemo(() => {
    const byTier: Partial<Record<PlanId, number>> = {};
    for (const pkg of packages) {
      if (pkg.packageType === 'MONTHLY') byTier[tierFromPackage(pkg)] = pkg.product.price;
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
        <Text className="text-base text-text-secondary mb-6">
          Unlock unlimited hearts, streak protection, AI conversations, and more
        </Text>

        {/*
          Loss aversion (DESIGN.md §UX Psychology Principles #5) held to the
          ethical guardrails in that section: a real, already-owned streak, a
          true statement about the free tier, and no countdown or guilt copy.
        */}
        {currentTier === 'starter' && (profile?.streak ?? 0) > 0 && (
          <View className="rounded-2xl p-4 mb-6 bg-dark-card flex-row items-center">
            <Ionicons name="flame" size={20} color={colors.streak.fire} />
            <Text className="flex-1 text-sm text-text-secondary ml-3">
              Your{' '}
              <Text style={{ color: colors.streak.fire, fontWeight: '700' }}>
                {profile?.streak}-day streak
              </Text>{' '}
              has no streak shield on the free plan.
            </Text>
          </View>
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
            const isCurrentPlan = tier === currentTier;
            const isPopular = tier === 'premium';
            const features = PLAN_FEATURES[tier] ?? [];

            // Annual plans lead with their true per-month equivalent; the
            // full amount and billing term stay visible directly beneath it.
            const isAnnual = pkg.packageType === 'ANNUAL';
            const perMonthString = isAnnual ? pkg.product.pricePerMonthString : null;
            const monthlyPrice = monthlyPriceByTier[tier];
            const savingsPct =
              isAnnual && monthlyPrice && monthlyPrice > 0
                ? Math.round((1 - pkg.product.price / (monthlyPrice * 12)) * 100)
                : 0;

            return (
              <View
                key={pkg.identifier}
                className={`rounded-2xl p-5 mb-4 border-2 ${
                  isCurrentPlan
                    ? 'border-success bg-success-bg'
                    : isPopular
                    ? 'border-primary bg-dark-card'
                    : 'border-dark-border bg-dark-card'
                }`}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  {isCurrentPlan && <Badge variant="success" label="Current Plan" />}
                  {isPopular && !isCurrentPlan && (
                    <View className="bg-primary rounded-lg px-3 py-1">
                      <Text className="text-white text-xs font-bold">MOST POPULAR</Text>
                    </View>
                  )}
                </View>

                <View className="flex-row items-baseline mb-1">
                  <Text className="text-2xl font-bold text-text-primary">
                    {perMonthString ?? pkg.product.priceString}
                  </Text>
                  <Text className="text-sm text-text-secondary ml-1">
                    /{isAnnual && perMonthString ? 'mo' : 'month'}
                  </Text>
                  {savingsPct > 0 && (
                    <View className="bg-success-bg rounded-lg px-2 py-0.5 ml-2">
                      <Text className="text-xs font-bold text-success">SAVE {savingsPct}%</Text>
                    </View>
                  )}
                </View>
                {isAnnual && (
                  <Text className="text-sm text-text-secondary mb-1">
                    Billed annually at {pkg.product.priceString}
                  </Text>
                )}
                <Text className="text-lg font-semibold text-text-primary mb-3">{pkg.product.title}</Text>

                {features.map((feature, idx) => (
                  <View key={idx} className="flex-row items-center mb-2">
                    <Ionicons name="checkmark-circle" size={18} color={colors.success.light} />
                    <Text className="text-sm text-text-secondary ml-2">{feature}</Text>
                  </View>
                ))}

                {!isCurrentPlan && (
                  <View className="mt-4">
                    <Button
                      label="Subscribe"
                      variant={isPopular ? 'primary' : 'secondary'}
                      onPress={() => handlePurchase(pkg)}
                      loading={purchasingId === pkg.identifier}
                      disabled={purchasingId !== null || restoring}
                    />
                  </View>
                )}
              </View>
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
        <View className="flex-row justify-center gap-4 mt-4">
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
