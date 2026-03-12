import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { openCheckout, PRICING_PLANS } from '../../../lib/stripe';
import { fetchSubscription } from '../../../lib/supabase-queries';
import { useEffect } from 'react';
import type { Subscription } from '../../../types';
import { trackEvent } from '../../../lib/analytics';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('basic_monthly');

  useEffect(() => {
    if (!user) return;

    fetchSubscription(user.id)
      .then(setSubscription)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user]);

  const handlePurchase = async (priceKey: string) => {
    if (!user?.email) {
      Alert.alert('Error', 'Please sign in to subscribe.');
      return;
    }

    setIsPurchasing(true);
    try {
      trackEvent('subscription_started', { plan: priceKey });

      await openCheckout({
        userId: user.id,
        email: user.email,
        priceKey: priceKey as any,
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to start checkout');
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  const isSubscribed = subscription?.isActive && subscription.tier !== 'free';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Header */}
        <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }} accessibilityRole="button">
          <Text style={{ fontSize: 16, color: '#6366F1' }}>Back</Text>
        </Pressable>

        <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 4 }} accessibilityRole="header">
          {isSubscribed ? 'Your Subscription' : 'Upgrade Your Plan'}
        </Text>
        <Text style={{ fontSize: 15, color: '#666', marginBottom: 24 }}>
          {isSubscribed
            ? `You're on the ${subscription.tier} plan.`
            : 'Unlock more learning with a paid subscription.'}
        </Text>

        {/* Current plan status */}
        {isSubscribed && subscription.currentPeriodEnd && (
          <View style={{ backgroundColor: '#DCFCE7', padding: 16, borderRadius: 12, marginBottom: 24 }}>
            <Text style={{ fontSize: 15, color: '#166534', fontWeight: '500' }}>
              Active until {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </Text>
          </View>
        )}

        {/* Plans */}
        {PRICING_PLANS.map((plan) => {
          const isCurrentPlan = subscription?.tier === plan.planId;
          const isSelected = selectedPlan === plan.key;
          const isPaid = plan.key !== 'free';

          return (
            <Pressable
              key={plan.key}
              onPress={() => isPaid && setSelectedPlan(plan.key)}
              style={{
                borderWidth: 2,
                borderColor: isSelected && isPaid ? '#6366F1' : isCurrentPlan ? '#22C55E' : '#E5E7EB',
                borderRadius: 16,
                padding: 20,
                marginBottom: 12,
                backgroundColor: isSelected && isPaid ? '#F5F3FF' : '#fff',
                position: 'relative',
              }}
              accessibilityRole="button"
              accessibilityLabel={`${plan.name} plan: ${plan.price}${plan.period}`}
            >
              {'popular' in plan && plan.popular && (
                <View style={{
                  position: 'absolute',
                  top: -10,
                  right: 16,
                  backgroundColor: '#6366F1',
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 8,
                }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>POPULAR</Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 20, fontWeight: '700' }}>{plan.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: '#6366F1' }}>
                    {plan.price}
                  </Text>
                  {plan.period ? (
                    <Text style={{ fontSize: 14, color: '#666' }}>{plan.period}</Text>
                  ) : null}
                </View>
              </View>

              {'savings' in plan && (
                <Text style={{ fontSize: 13, color: '#22C55E', fontWeight: '600', marginBottom: 8 }}>
                  {plan.savings}
                </Text>
              )}

              {plan.features.map((feature) => (
                <Text key={feature} style={{ fontSize: 14, color: '#444', marginBottom: 4 }}>
                  + {feature}
                </Text>
              ))}

              {isCurrentPlan && (
                <Text style={{ fontSize: 13, color: '#22C55E', fontWeight: '600', marginTop: 8 }}>
                  Current plan
                </Text>
              )}
            </Pressable>
          );
        })}

        {/* Purchase button */}
        {!isSubscribed && selectedPlan !== 'free' && (
          <Pressable
            onPress={() => handlePurchase(selectedPlan)}
            disabled={isPurchasing}
            style={{
              backgroundColor: '#6366F1',
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: 'center',
              marginTop: 12,
            }}
            accessibilityRole="button"
            accessibilityLabel="Subscribe now"
          >
            {isPurchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
                Subscribe Now
              </Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
