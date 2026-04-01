import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { upsertProfile, markOnboardingComplete, updateOnboardingChecklist } from '../../lib/supabase-queries';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../../components/ui/Button';
import { PlacementTest } from '../../components/onboarding/PlacementTest';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { SUPPORTED_LANGUAGES, DAILY_GOALS } from '../../config/app';
import { openCheckout, PRICING_PLANS } from '../../lib/stripe';
import type { LanguageCode, ProficiencyLevel } from '../../types';

const LEVELS: { value: ProficiencyLevel; label: string; description: string }[] = [
  { value: 'beginner', label: 'Beginner', description: 'I know a few words' },
  { value: 'elementary', label: 'Elementary', description: 'I can form basic sentences' },
  { value: 'intermediate', label: 'Intermediate', description: 'I can hold simple conversations' },
  { value: 'upper_intermediate', label: 'Upper Intermediate', description: 'I can discuss many topics' },
  { value: 'advanced', label: 'Advanced', description: 'I\'m nearly fluent' },
];

type Step = 'language' | 'level' | 'placement' | 'goal' | 'subscription';

const ALL_STEPS: Step[] = ['language', 'level', 'placement', 'goal', 'subscription'];

export default function OnboardingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { profile, loadUserData } = useAppStore();

  const [step, setStep] = useState<Step>('language');

  // Resume at subscription step if profile exists but onboarding not completed
  useEffect(() => {
    if (profile && !profile.onboardingCompleted) {
      setStep('subscription');
    }
  }, [profile]);
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode | null>(null);
  const [level, setLevel] = useState<ProficiencyLevel | null>(null);
  const [dailyGoal, setDailyGoal] = useState<number>(10);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [placementCompleted, setPlacementCompleted] = useState(false);

  const handleSaveProfile = async () => {
    if (!user || !targetLanguage || !level) return;
    setSaving(true);
    try {
      await upsertProfile(user.id, {
        nativeLanguage: 'en' as LanguageCode,
        targetLanguage,
        level,
        dailyGoalMinutes: dailyGoal,
      });
      // Seed onboarding checklist with pre-checked items
      await updateOnboardingChecklist(user.id, {
        chooseLanguage: true,
        placementTest: placementCompleted,
        firstLesson: false,
        aiConversation: false,
        dailyReminder: false,
        collapsed: false,
        dismissed: false,
        completedAt: null,
      });
      await loadUserData(user.id);
      setStep('subscription');
    } catch (err: unknown) {
      console.error('handleSaveProfile error:', err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as Record<string, unknown>).message)
            : 'Something went wrong';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleContinueFree = async () => {
    try {
      if (user) {
        await markOnboardingComplete(user.id);
        await loadUserData(user.id);
      }
      router.replace('/(app)');
    } catch (err: unknown) {
      console.error('handleContinueFree error:', err);
      // Navigate anyway — worst case the route guard will redirect back
      router.replace('/(app)');
    }
  };

  const handleSubscribe = async (priceKey: string) => {
    if (!user) return;
    setSubscribing(priceKey);
    try {
      // Mark onboarding complete before opening checkout (browser redirect)
      await markOnboardingComplete(user.id);
      await openCheckout({
        userId: user.id,
        email: user.email ?? '',
        priceKey,
      });
      await loadUserData(user.id);
    } catch (err: unknown) {
      console.error('handleSubscribe error:', err);
      Alert.alert(
        'Subscriptions Coming Soon',
        'Paid plans are not yet available. Continue with the free plan for now \u2014 you can upgrade anytime from your profile.',
      );
    } finally {
      setSubscribing(null);
    }
  };

  return (
    <GradientBackground>
    <SafeAreaView className="flex-1">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Step indicator */}
        <View className="flex-row gap-2 mb-8">
          {ALL_STEPS.map((s) => {
            const currentIdx = ALL_STEPS.indexOf(step);
            const thisIdx = ALL_STEPS.indexOf(s);
            return (
              <View
                key={s}
                className={`flex-1 h-1.5 rounded-full ${thisIdx <= currentIdx ? 'bg-primary' : 'bg-dark-card-alt'}`}
              />
            );
          })}
        </View>

        {step === 'language' && (
          <>
            <Text className="text-[28px] font-bold text-text-primary mb-2" accessibilityRole="header">
              What language do you want to learn?
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              You can change this later in settings.
            </Text>

            {SUPPORTED_LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                className={`p-[18px] rounded-2xl mb-3 flex-row items-center ${
                  targetLanguage === lang.code
                    ? 'bg-primary-tint border-2 border-primary'
                    : 'bg-dark-card border-2 border-transparent'
                }`}
                onPress={() => setTargetLanguage(lang.code as LanguageCode)}
                accessibilityRole="button"
                accessibilityLabel={lang.name}
                accessibilityState={{ selected: targetLanguage === lang.code }}
              >
                <Text className="text-2xl mr-3">{lang.flag}</Text>
                <Text className="text-lg font-semibold text-text-primary">{lang.name}</Text>
              </Pressable>
            ))}

            <View className="mt-6">
              <Button
                label="Continue"
                onPress={() => setStep('level')}
                disabled={!targetLanguage}
              />
            </View>
          </>
        )}

        {step === 'level' && (
          <>
            <Text className="text-[28px] font-bold text-text-primary mb-2" accessibilityRole="header">
              What's your level?
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              We'll personalize your experience.
            </Text>

            {LEVELS.map((l) => (
              <Pressable
                key={l.value}
                className={`p-[18px] rounded-2xl mb-3 ${
                  level === l.value
                    ? 'bg-primary-tint border-2 border-primary'
                    : 'bg-dark-card border-2 border-transparent'
                }`}
                onPress={() => setLevel(l.value)}
                accessibilityRole="button"
                accessibilityLabel={`${l.label}: ${l.description}`}
                accessibilityState={{ selected: level === l.value }}
              >
                <Text className="text-lg font-semibold text-text-primary">{l.label}</Text>
                <Text className="text-sm text-text-secondary mt-1">{l.description}</Text>
              </Pressable>
            ))}

            <View className="flex-row gap-3 mt-6">
              <View className="flex-1">
                <Button label="Back" variant="secondary" onPress={() => setStep('language')} />
              </View>
              <View className="flex-1">
                <Button
                  label="Continue"
                  onPress={() => setStep('placement')}
                  disabled={!level}
                />
              </View>
            </View>
          </>
        )}

        {step === 'placement' && (
          <>
            <Text className="text-[28px] font-bold text-text-primary mb-2" accessibilityRole="header">
              Quick Placement Test
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              Answer a few questions so we can fine-tune your starting level.
            </Text>
            <PlacementTest
              targetLanguage={targetLanguage ?? 'es'}
              onComplete={(suggestedLevel) => {
                setLevel(suggestedLevel);
                setPlacementCompleted(true);
                setStep('goal');
              }}
              onSkip={() => setStep('goal')}
            />
          </>
        )}

        {step === 'goal' && (
          <>
            <Text className="text-[28px] font-bold text-text-primary mb-2" accessibilityRole="header">
              Set your daily goal
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              How many minutes per day do you want to practice?
            </Text>

            {DAILY_GOALS.map((goal) => (
              <Pressable
                key={goal}
                className={`p-[18px] rounded-2xl mb-3 flex-row items-center justify-between ${
                  dailyGoal === goal
                    ? 'bg-primary-tint border-2 border-primary'
                    : 'bg-dark-card border-2 border-transparent'
                }`}
                onPress={() => setDailyGoal(goal)}
                accessibilityRole="button"
                accessibilityLabel={`${goal} minutes per day`}
                accessibilityState={{ selected: dailyGoal === goal }}
              >
                <Text className="text-lg font-semibold text-text-primary">{goal} minutes</Text>
                {goal === 5 && <Text className="text-sm text-text-secondary">Casual</Text>}
                {goal === 10 && <Text className="text-sm text-text-secondary">Regular</Text>}
                {goal === 15 && <Text className="text-sm text-text-secondary">Serious</Text>}
                {goal === 20 && <Text className="text-sm text-text-secondary">Intense</Text>}
                {goal === 30 && <Text className="text-sm text-text-secondary">Insane</Text>}
              </Pressable>
            ))}

            <View className="flex-row gap-3 mt-6">
              <View className="flex-1">
                <Button label="Back" variant="secondary" onPress={() => setStep('placement')} />
              </View>
              <View className="flex-1">
                <Button
                  label="Continue"
                  onPress={handleSaveProfile}
                  loading={saving}
                  disabled={saving}
                />
              </View>
            </View>
          </>
        )}

        {step === 'subscription' && (
          <>
            {/* Hero section */}
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-primary items-center justify-center mb-4">
                <Ionicons name="rocket" size={32} color="#FFFFFF" />
              </View>
              <Text className="text-[28px] font-bold text-text-primary mb-2 text-center" accessibilityRole="header">
                Unlock Your Full Potential
              </Text>
              <Text className="text-base text-text-secondary text-center">
                Choose a plan to supercharge your learning with unlimited AI conversations, voice practice, and more.
              </Text>
            </View>

            {/* Plan cards */}
            {PRICING_PLANS.filter((p) => p.planId !== 'free').map((plan) => (
              <Pressable
                key={plan.key}
                className={`rounded-2xl mb-4 p-5 border-2 ${
                  'popular' in plan && plan.popular
                    ? 'bg-dark-card border-primary'
                    : 'bg-dark-card border-dark-border'
                }`}
                onPress={() => handleSubscribe(plan.key)}
                accessibilityRole="button"
                accessibilityLabel={`${plan.name} plan at ${plan.price}${plan.period}`}
              >
                {/* Popular badge */}
                {'popular' in plan && plan.popular && (
                  <View className="bg-primary rounded-full px-3 py-1 self-start mb-3">
                    <Text className="text-xs font-bold text-white">MOST POPULAR</Text>
                  </View>
                )}

                <View className="flex-row items-baseline mb-3">
                  <Text className="text-2xl font-bold text-text-primary">{plan.price}</Text>
                  <Text className="text-sm text-text-secondary ml-1">{plan.period}</Text>
                </View>

                <Text className="text-lg font-semibold text-text-primary mb-3">{plan.name}</Text>

                {plan.features.map((feature, i) => (
                  <View key={i} className="flex-row items-center mb-2">
                    <Ionicons name="checkmark-circle" size={18} color="#38BDF8" />
                    <Text className="text-sm text-text-secondary ml-2 flex-1">{feature}</Text>
                  </View>
                ))}

                <View className="mt-3">
                  <Button
                    label={subscribing === plan.key ? 'Opening checkout...' : `Get ${plan.name}`}
                    onPress={() => handleSubscribe(plan.key)}
                    loading={subscribing === plan.key}
                    disabled={subscribing !== null}
                  />
                </View>
              </Pressable>
            ))}

            {/* Free tier section */}
            <View className="rounded-2xl p-5 bg-dark-card-alt border-2 border-dark-border mb-4">
              <Text className="text-lg font-semibold text-text-primary mb-2">Free Plan</Text>
              <Text className="text-sm text-text-secondary mb-3">
                Get started with basic features — upgrade anytime.
              </Text>
              {PRICING_PLANS.find((p) => p.planId === 'free')?.features.map((feature, i) => (
                <View key={i} className="flex-row items-center mb-2">
                  <Ionicons name="checkmark-circle-outline" size={18} color="#64748B" />
                  <Text className="text-sm text-text-tertiary ml-2 flex-1">{feature}</Text>
                </View>
              ))}
            </View>

            <Button
              label="Continue with Free"
              variant="secondary"
              onPress={handleContinueFree}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
    </GradientBackground>
  );
}
