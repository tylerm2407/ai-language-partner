/**
 * Post-first-lesson paywall — design 7c, hard gate.
 *
 * Replaces the previous three-PlanCard + "Continue with Free" screen. Two
 * changes, both product decisions, not cosmetics:
 *
 *   1. HARD PAYWALL. There is no free tier any more, so there is no skip. The
 *      7-day trial is the free path. Everything the old skip protected (a
 *      learner who cannot buy) now falls to `blocked` below — an offerings
 *      failure must NOT strand someone in the app with no way forward.
 *   2. Per-day pricing. Each rung leads with its daily equivalent, with the
 *      billed amount immediately beneath it. See lib/plan-pricing.ts.
 *
 * Unchanged and load-bearing: this screen runs AFTER sign-up (RevenueCat is
 * configured with the real user id — an anonymous purchase never reaches the
 * `subscriptions` table) and AFTER the first completed lesson, fired from
 * app/(app)/learn/[lessonId].tsx.
 */
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
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
import { STEP_ORDER, ctaLabel, renewalLine, trialOffer } from '../../lib/plan-pricing';
import { trackEvent } from '../../lib/analytics';
import { PlanStepCard } from '../../components/subscription/PlanStepCard';
import { colors, radii, spacing, typography } from '../../config/theme';
import { GlowLayer } from '../../components/ui/GlowBackground';
import { TERMS_URL, PRIVACY_URL } from '../../config/app';

type BillingTerm = 'monthly' | 'annual';

const DEFAULT_TIER: Exclude<PlanId, 'starter'> = 'premium';

export default function PlansScreen() {
  const { user } = useAuth();
  const { subscription, refreshSubscription } = useAppStore();
  const router = useRouter();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [term, setTerm] = useState<BillingTerm>('annual');
  const [tier, setTier] = useState<Exclude<PlanId, 'starter'>>(DEFAULT_TIER);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const currentTier = subscription?.tier ?? 'starter';

  /** Leave the paywall. Only reachable once entitled, restored, or blocked. */
  const proceed = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)');
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pkgs = await getOfferingPackages();
        if (!cancelled) setPackages(pkgs);
      } catch (err) {
        console.error('[plans] offerings failed:', err);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    trackEvent('paywall_viewed', { source: 'post_first_lesson', currentTier, gate: 'hard' });
  }, [currentTier]);

  const monthlyPriceByTier = useMemo(() => {
    const byTier: Partial<Record<PlanId, number>> = {};
    for (const pkg of packages) {
      if (isMonthlyPackage(pkg)) byTier[tierFromPackage(pkg)] = pkg.product.price;
    }
    return byTier;
  }, [packages]);

  /** The three rungs for the selected term, cheapest first. */
  const rungs = useMemo(() => {
    const wantAnnual = term === 'annual';
    return STEP_ORDER.map((t) =>
      packages.find(
        (p) => tierFromPackage(p) === t && (wantAnnual ? isAnnualPackage(p) : isMonthlyPackage(p)),
      ),
    ).filter((p): p is PurchasesPackage => Boolean(p));
  }, [packages, term]);

  const bestSavings = useMemo(() => {
    let best = 0;
    for (const pkg of packages) {
      if (!isAnnualPackage(pkg)) continue;
      best = Math.max(
        best,
        annualSavingsPercent(pkg.product.price, monthlyPriceByTier[tierFromPackage(pkg)]),
      );
    }
    return best;
  }, [packages, monthlyPriceByTier]);

  const selectedPkg = useMemo(
    () => rungs.find((p) => tierFromPackage(p) === tier) ?? rungs[rungs.length - 1],
    [rungs, tier],
  );

  const handlePurchase = async () => {
    if (!user || !selectedPkg) return;
    setPurchasing(true);
    try {
      const result = await purchasePackage(selectedPkg);
      if (result.status === 'success') {
        trackEvent('purchase_completed', { tier: result.tier ?? tierFromPackage(selectedPkg) });
        await refreshSubscription(user.id);
        setTimeout(() => user && refreshSubscription(user.id), 2500);
        proceed();
      } else if (result.status === 'error') {
        Alert.alert('Purchase failed', result.message ?? 'Please try again.');
      }
    } finally {
      setPurchasing(false);
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

  const busy = purchasing || restoring;
  /**
   * Nothing to sell: no IAP on this build, the offerings call failed, or the
   * offering came back empty. A hard paywall must still let this learner
   * through — a blank gate is a 3.1.1 rejection and, worse, a dead app.
   */
  const blocked = !loading && (!isPurchasesAvailable() || failed || rungs.length === 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base }}>
      <GlowLayer />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md + 4, paddingBottom: spacing.lg }}>
        {/* The advertising line is the headline — unquoted, in the display face. */}
        <Text
          style={{
            fontFamily: typography.family.display,
            fontSize: 30,
            lineHeight: 38,
            letterSpacing: -1,
            color: colors.text.primary,
            marginTop: spacing.lg + 2,
          }}
        >
          Learning a language can now be done during your drive to work.
        </Text>
        <Text
          style={{
            fontFamily: typography.family.monoMedium,
            fontSize: 10,
            lineHeight: 14,
            letterSpacing: 2.4,
            color: colors.action.accent,
            marginTop: spacing.sm,
          }}
        >
          HANDS-FREE VOICE PRACTICE
        </Text>

        {loading ? (
          <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.action.accent} />
          </View>
        ) : blocked ? (
          <View
            style={{
              marginTop: spacing.lg,
              borderRadius: radii.xl,
              padding: spacing.md + 4,
              backgroundColor: colors.surface.card,
              borderWidth: 1,
              borderColor: colors.border.default,
            }}
          >
            <Text
              style={{
                fontFamily: typography.family.medium,
                fontSize: 16,
                lineHeight: 24,
                color: colors.text.secondary,
              }}
            >
              Plans aren’t available right now. Carry on learning — you can subscribe any time from
              your profile.
            </Text>
            <Pressable
              onPress={proceed}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm }}
            >
              <Text
                style={{
                  fontFamily: typography.family.bold,
                  fontSize: 15,
                  lineHeight: 21,
                  color: colors.action.accent,
                }}
              >
                Continue
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Term toggle. Annual carries the saving badge and is pre-selected:
                annual-default paywalls see 35–45% of subscribers pick annual
                vs 15–20% when monthly leads (RevenueCat 2025). */}
            <View
              style={{
                flexDirection: 'row',
                padding: 4,
                borderRadius: radii.lg,
                backgroundColor: colors.surface.card,
                borderWidth: 1,
                borderColor: colors.border.subtle,
                marginTop: spacing.lg,
              }}
              accessibilityRole="tablist"
            >
              {(['monthly', 'annual'] as BillingTerm[]).map((opt) => {
                const on = term === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setTerm(opt)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={
                      opt === 'annual' && bestSavings > 0
                        ? `Annual billing, save ${bestSavings} percent`
                        : `${opt} billing`
                    }
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      minHeight: 44,
                      borderRadius: radii.md,
                      backgroundColor: on ? colors.action.primaryFill : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: typography.family.extrabold,
                        fontSize: 13,
                        lineHeight: 18,
                        color: on ? colors.text.onPrimary : colors.text.tertiary,
                      }}
                    >
                      {opt === 'annual' ? 'Annual' : 'Monthly'}
                    </Text>
                    {opt === 'annual' && bestSavings > 0 && (
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: radii.sm - 2,
                          backgroundColor: on ? 'rgba(255,255,255,0.22)' : colors.success.tint,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: typography.family.monoMedium,
                            fontSize: 9,
                            lineHeight: 12,
                            color: on ? colors.text.onPrimary : colors.success.light,
                          }}
                        >
                          −{bestSavings}%
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={{ gap: spacing.xs, marginTop: spacing.sm + 2 }} accessibilityRole="radiogroup">
              {rungs.map((pkg) => {
                const t = tierFromPackage(pkg) as Exclude<PlanId, 'starter'>;
                return (
                  <PlanStepCard
                    key={pkg.identifier}
                    pkg={pkg}
                    tier={t}
                    selected={tier === t}
                    isPopular={t === 'premium'}
                    onSelect={() => setTier(t)}
                    disabled={busy}
                  />
                );
              })}
            </View>

            <View
              style={{
                marginTop: spacing.sm + 1,
                padding: spacing.md - 2,
                borderRadius: radii.xl,
                backgroundColor: colors.surface.card,
                borderWidth: 1,
                borderColor: colors.border.subtle,
              }}
            >
              <Text
                style={{
                  fontFamily: typography.family.serif,
                  fontSize: 15,
                  lineHeight: 22,
                  color: colors.text.secondary,
                }}
              >
                Learning a language has never been this easy.
              </Text>
            </View>

            {/* CTA */}
            <Pressable
              onPress={handlePurchase}
              disabled={busy || !selectedPkg}
              accessibilityRole="button"
              accessibilityLabel={selectedPkg ? ctaLabel(selectedPkg, tier) : 'Subscribe'}
              style={{ marginTop: spacing.md }}
            >
              <LinearGradient
                colors={[colors.action.primaryFill, colors.magazine.accentViolet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  minHeight: 52,
                  borderRadius: radii.xl,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {purchasing ? (
                  <ActivityIndicator color={colors.text.onPrimary} />
                ) : (
                  <Text
                    style={{
                      fontFamily: typography.family.extrabold,
                      fontSize: 16,
                      lineHeight: 22,
                      color: colors.text.onPrimary,
                    }}
                  >
                    {selectedPkg ? ctaLabel(selectedPkg, tier) : ''}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            {/* Renewal terms, verbatim from the store product. Required in the
                binary by App Review, and the honest thing to show. */}
            <Text
              style={{
                fontFamily: typography.family.semibold,
                fontSize: 11,
                lineHeight: 16,
                textAlign: 'center',
                color: colors.text.quaternary,
                marginTop: spacing.sm - 2,
              }}
            >
              {selectedPkg ? renewalLine(selectedPkg) : ''}
            </Text>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: spacing.md - 2,
                marginTop: spacing.sm,
              }}
            >
              <Pressable
                onPress={() => Linking.openURL(TERMS_URL)}
                accessibilityRole="link"
                accessibilityLabel="Terms of use"
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={legalStyle}>Terms</Text>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL(PRIVACY_URL)}
                accessibilityRole="link"
                accessibilityLabel="Privacy policy"
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={legalStyle}>Privacy</Text>
              </Pressable>
              <Pressable
                onPress={handleRestore}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Restore purchases"
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={legalStyle}>{restoring ? 'Restoring…' : 'Restore purchases'}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const legalStyle = {
  fontFamily: typography.family.semibold,
  fontSize: 10,
  lineHeight: 14,
  color: colors.text.quaternary,
} as const;
