/**
 * The subscription paywall — shown once at the end of setup, and reachable
 * afterwards from the profile.
 *
 * NOT a hard gate any more. A free tier exists (lib/plans.ts `starter`), so
 * this screen has a visible way out and the router no longer redirects
 * unsubscribed learners here (app/(app)/_layout.tsx). What survives from the
 * 7c design is the shape of the ask: per-day pricing, three rungs, annual
 * pre-selected.
 *
 * Two things about when it fires are load-bearing:
 *   • AFTER sign-up. RevenueCat must be configured with the real user id — an
 *     anonymous purchase never reaches the `subscriptions` table.
 *   • AFTER the learner has been taught something. The trial lesson now runs
 *     before the account exists (app/(public)/onboarding.tsx), so by the time
 *     anyone sees this screen they have finished a lesson, earned XP, and made
 *     an avatar. The ask lands on a real result rather than on an empty account.
 *
 * `blocked` is still the review-safety escape for an offerings failure. It
 * matters less now that every learner has a working free tier to fall back on,
 * but a paywall with nothing to buy and no way out is still a 3.1.1 rejection.
 */
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  reportPurchaseFailure,
} from '../../lib/purchases';
import { type PlanId } from '../../lib/plans';
import { STEP_ORDER, ctaLabel, renewalLine } from '../../lib/plan-pricing';
import { trackEvent } from '../../lib/analytics';
import { PlanStepCard } from '../../components/subscription/PlanStepCard';
import { SlabButton } from '../../components/ui2/SlabButton';
import { SlabCard } from '../../components/ui2/SlabCard';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to. `radii` and
// `spacing` are plain scheme-independent numbers and carry over unchanged.
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { radii, spacing } from '../../config/theme';
import { TERMS_URL, PRIVACY_URL } from '../../config/app';
import { useScreenView } from '../../hooks/useScreenView';

type BillingTerm = 'monthly' | 'annual';

const DEFAULT_TIER: Exclude<PlanId, 'starter'> = 'premium';

export default function PlansScreen() {
  const { c, type } = useUi2Theme();
  useScreenView('paywall');
  const { user } = useAuth();
  const { subscription, refreshSubscription, setEntitledTier } = useAppStore();
  const router = useRouter();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [term, setTerm] = useState<BillingTerm>('annual');
  const [tier, setTier] = useState<Exclude<PlanId, 'starter'>>(DEFAULT_TIER);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Refs, not the state above: state cannot close a same-React-batch double
  // tap, and both of these start a payment flow.
  const purchaseInFlight = useRef(false);
  const restoreInFlight = useRef(false);

  const currentTier = subscription?.tier ?? 'starter';

  /**
   * Leave the paywall — after a purchase, a restore, an offerings failure, or
   * a deliberate "stay on the free plan".
   *
   * `canGoBack` is false on the setup path: avatar-setup REPLACES into this
   * screen rather than pushing, precisely so a learner cannot swipe back into
   * a finished step. Falling through to Home is what makes the exit work there.
   */
  const proceed = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)');
  }, [router]);

  /** Decline, and stay on the free plan. */
  const declineToFree = useCallback(() => {
    trackEvent('paywall_declined', { currentTier, tierShown: tier, term });
    proceed();
  }, [proceed, currentTier, tier, term]);

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
    trackEvent('paywall_viewed', { source: 'post_signup', currentTier, gate: 'soft' });
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
    // The button is already disabled on `purchasing`, but state cannot close
    // the same-batch window — and this one starts a payment.
    if (purchaseInFlight.current) return;
    purchaseInFlight.current = true;
    setPurchasing(true);
    const requestedTier = tierFromPackage(selectedPkg);
    trackEvent('purchase_started', {
      tier: requestedTier,
      term,
      provider: 'revenuecat',
      outcome: 'attempted',
    });
    try {
      const result = await purchasePackage(selectedPkg);
      if (result.status === 'success') {
        const tier = result.tier ?? tierFromPackage(selectedPkg);
        trackEvent('purchase_provider_confirmed', {
          tier,
          term,
          provider: 'revenuecat',
          outcome: 'sdk_entitlement_confirmed',
        });
        // Open the gate on the entitlement RevenueCat just confirmed, BEFORE
        // navigating. `proceed()` remounts app/(app)/_layout.tsx, which reads
        // the tier and redirects straight back here if it still says
        // `starter` — which the server row does until the webhook lands.
        setEntitledTier(tier);
        await refreshSubscription(user.id);
        setTimeout(() => user && refreshSubscription(user.id), 2500);
        proceed();
      } else if (result.status === 'error') {
        trackEvent('purchase_failed', {
          tier: requestedTier,
          term,
          provider: 'revenuecat',
          outcome: 'sdk_error',
          code: result.code,
        });
        reportPurchaseFailure('purchase', result.message, tierFromPackage(selectedPkg), result.code);
        Alert.alert('Purchase failed', result.message ?? 'Please try again.');
      } else {
        trackEvent('purchase_cancelled', {
          tier: requestedTier,
          term,
          provider: 'revenuecat',
          outcome: 'user_cancelled',
        });
      }
    } finally {
      purchaseInFlight.current = false;
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!user) return;
    if (restoreInFlight.current) return;
    restoreInFlight.current = true;
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.status === 'success' && result.tier && result.tier !== 'starter') {
        trackEvent('purchase_restored', { tier: result.tier });
        setEntitledTier(result.tier);
        await refreshSubscription(user.id);
        proceed();
      } else if (result.status === 'error') {
        // A restore that could not reach the store has NOT established that the
        // learner owns nothing. Telling a subscriber "No purchases found" after
        // a network failure is a different — and wrong — claim, and it is the
        // one they will act on. `profile/subscription.tsx` already separates
        // these two; the two screens contradicted each other.
        reportPurchaseFailure('restore', result.message, undefined, result.code);
        Alert.alert('Restore failed', result.message ?? 'Please check your connection and try again.');
      } else {
        Alert.alert('No purchases found', 'We couldn’t find an active subscription to restore.');
      }
    } finally {
      restoreInFlight.current = false;
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

  // Was a module-level const; the palette is per-scheme, so it has to be read
  // inside the component. Same three numbers, same three call sites.
  const legalStyle = {
    fontFamily: type.ui,
    fontSize: 10,
    lineHeight: 14,
    color: c.idle,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md + 4, paddingBottom: spacing.lg }}>
        {/* The advertising line is the headline — unquoted, in the display face. */}
        <Text
          style={{
            fontFamily: type.heading,
            fontSize: 30,
            lineHeight: 38,
            letterSpacing: -1,
            color: c.ink,
            marginTop: spacing.lg + 2,
          }}
        >
          Learning a language can now be done during your drive to work.
        </Text>
        <Text
          style={{
            fontFamily: type.uiHeavy,
            fontSize: 10,
            lineHeight: 14,
            letterSpacing: 2.4,
            color: c.onTint,
            marginTop: spacing.sm,
          }}
        >
          HANDS-FREE VOICE PRACTICE
        </Text>

        {loading ? (
          <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={c.primary} />
          </View>
        ) : blocked ? (
          <SlabCard style={{ marginTop: spacing.lg, padding: spacing.md + 4 }}>
            <Text
              style={{
                fontFamily: type.ui,
                fontSize: 16,
                lineHeight: 24,
                color: c.muted,
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
                  fontFamily: type.uiBold,
                  fontSize: 15,
                  lineHeight: 21,
                  color: c.onTint,
                }}
              >
                Continue
              </Text>
            </Pressable>
          </SlabCard>
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
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.cardBorder,
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
                      backgroundColor: on ? c.primary : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: type.uiHeavy,
                        fontSize: 13,
                        lineHeight: 18,
                        color: on ? c.onPrimary : c.idle,
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
                          backgroundColor: on ? c.ctaOnPrimaryBg : c.greenTint,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: type.uiHeavy,
                            fontSize: 9,
                            lineHeight: 12,
                            color: on ? c.ctaOnPrimaryText : c.green,
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

            <SlabCard style={{ marginTop: spacing.sm + 1, padding: spacing.md - 2 }}>
              <Text
                style={{
                  fontFamily: type.ui,
                  fontSize: 15,
                  lineHeight: 22,
                  color: c.muted,
                }}
              >
                Learning a language has never been this easy.
              </Text>
            </SlabCard>

            {/* CTA */}
            <SlabButton
              label={selectedPkg ? ctaLabel(selectedPkg, tier) : 'Subscribe'}
              onPress={handlePurchase}
              loading={purchasing}
              disabled={busy || !selectedPkg}
              arrow={false}
              style={{ marginTop: spacing.md }}
            />

            {/* Renewal terms, verbatim from the store product. Required in the
                binary by App Review, and the honest thing to show. */}
            <Text
              style={{
                fontFamily: type.ui,
                fontSize: 11,
                lineHeight: 16,
                textAlign: 'center',
                color: c.idle,
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

            {/* The way out. Plain, visible, and present from the first frame —
                no timer, no fade-in. A skip that appears only after a delay is
                the pattern App Review has rejected under 3.1.1, and a learner
                who cannot afford a subscription is still a learner. What the
                free plan actually includes is spelled out rather than implied,
                so declining is an informed choice and not a dead end. */}
            <Pressable
              onPress={declineToFree}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Continue on the free plan"
              style={{ minHeight: 44, justifyContent: 'center', marginTop: spacing.sm }}
            >
              <Text
                style={{
                  fontFamily: type.uiBold,
                  fontSize: 14,
                  lineHeight: 20,
                  textAlign: 'center',
                  color: c.muted,
                }}
              >
                Continue on the free plan
              </Text>
            </Pressable>
            <Text
              style={{
                fontFamily: type.ui,
                fontSize: 11,
                lineHeight: 16,
                textAlign: 'center',
                color: c.idle,
                marginTop: 2,
              }}
            >
              Lessons, reviews, reading and the daily news stay free. The AI tutor and voice
              practice don’t.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
