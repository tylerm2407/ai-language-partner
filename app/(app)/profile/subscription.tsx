import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { PRICING_PLANS, openCheckout } from '../../../lib/stripe';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Ionicons } from '@expo/vector-icons';

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const { subscription, refreshSubscription } = useAppStore();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const currentTier = subscription?.tier ?? 'free';

  // Refresh subscription every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) refreshSubscription(user.id);
    }, [user, refreshSubscription])
  );

  const handleSubscribe = async (priceKey: string) => {
    if (!user) return;
    setLoadingPlan(priceKey);
    try {
      await openCheckout({
        userId: user.id,
        email: user.email ?? '',
        priceKey,
      });
      // User returned from Stripe checkout — refresh subscription immediately
      await refreshSubscription(user.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Error', message);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-dark">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-dark-border">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color="#F1F5F9" />
        </Pressable>
        <Text className="text-lg font-semibold text-text-primary ml-3">Subscription</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="text-2xl font-bold text-text-primary mb-2">Choose Your Plan</Text>
        <Text className="text-base text-text-secondary mb-6">
          Unlock unlimited hearts, streak protection, AI conversations, and more
        </Text>

        {PRICING_PLANS.map((plan) => {
          const isCurrentPlan = plan.planId === currentTier;
          const isPopular = 'popular' in plan && plan.popular;

          return (
            <View
              key={plan.key}
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
                <Text className="text-2xl font-bold text-text-primary">{plan.price}</Text>
                {plan.period ? (
                  <Text className="text-sm text-text-secondary ml-1">{plan.period}</Text>
                ) : null}
              </View>
              <Text className="text-lg font-semibold text-text-primary mb-3">{plan.name}</Text>

              {plan.features.map((feature, idx) => (
                <View key={idx} className="flex-row items-center mb-2">
                  <Ionicons name="checkmark-circle" size={18} color={isCurrentPlan ? '#34D399' : '#34D399'} />
                  <Text className="text-sm text-text-secondary ml-2">{feature}</Text>
                </View>
              ))}

              {plan.planId !== 'free' && !isCurrentPlan && (
                <View className="mt-4">
                  <Button
                    label="Subscribe"
                    variant={isPopular ? 'primary' : 'secondary'}
                    onPress={() => handleSubscribe(plan.key)}
                    loading={loadingPlan === plan.key}
                    disabled={loadingPlan === plan.key}
                  />
                </View>
              )}

              {isCurrentPlan && plan.planId !== 'free' && (
                <Text className="text-sm text-success font-medium text-center mt-3">
                  Active until {subscription?.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                    : 'N/A'}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
