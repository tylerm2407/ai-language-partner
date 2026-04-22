import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { upsertProfile, markOnboardingComplete, updateOnboardingChecklist } from '../../lib/supabase-queries';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../../components/ui/Button';
import { PlacementTest } from '../../components/onboarding/PlacementTest';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { SUPPORTED_LANGUAGES, DAILY_GOALS } from '../../config/app';
import type { LanguageCode, ProficiencyLevel, MotivationReason } from '../../types';

const LEVELS: { value: ProficiencyLevel; label: string; description: string }[] = [
  { value: 'beginner', label: 'Beginner', description: 'I know a few words' },
  { value: 'elementary', label: 'Elementary', description: 'I can form basic sentences' },
  { value: 'intermediate', label: 'Intermediate', description: 'I can hold simple conversations' },
  { value: 'upper_intermediate', label: 'Upper Intermediate', description: 'I can discuss many topics' },
  { value: 'advanced', label: 'Advanced', description: 'I\'m nearly fluent' },
];

const MOTIVATIONS: { value: MotivationReason; label: string; description: string }[] = [
  { value: 'travel', label: 'Travel', description: 'Order, ask directions, connect on trips' },
  { value: 'family', label: 'Family & friends', description: 'Talk with the people who matter' },
  { value: 'work', label: 'Work & study', description: 'Unlock career or school opportunities' },
  { value: 'brain', label: 'Brain fitness', description: 'Keep your mind sharp' },
  { value: 'curious', label: 'Just curious', description: 'See where the journey takes me' },
];

type Step = 'language' | 'motivation' | 'level' | 'placement' | 'goal';

const ALL_STEPS: Step[] = ['language', 'motivation', 'level', 'placement', 'goal'];

export default function OnboardingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { loadUserData, setMotivation: storeSetMotivation } = useAppStore();

  const [step, setStep] = useState<Step>('language');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode | null>(null);
  const [motivation, setMotivation] = useState<MotivationReason | null>(null);
  const [level, setLevel] = useState<ProficiencyLevel | null>(null);
  const [dailyGoal, setDailyGoal] = useState<number>(10);
  const [saving, setSaving] = useState(false);
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
      await markOnboardingComplete(user.id);
      // Persist transient motivation in the store so Home's HeroHook can use it.
      storeSetMotivation(motivation);
      await loadUserData(user.id);
      router.replace('/(app)');
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
                onPress={() => setStep('motivation')}
                disabled={!targetLanguage}
              />
            </View>
          </>
        )}

        {step === 'motivation' && (
          <>
            <Text className="text-[28px] font-bold text-text-primary mb-2" accessibilityRole="header">
              Why are you learning?
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              We&apos;ll tailor your experience to what matters most.
            </Text>

            {MOTIVATIONS.map((m) => (
              <Pressable
                key={m.value}
                className={`p-[18px] rounded-2xl mb-3 ${
                  motivation === m.value
                    ? 'bg-primary-tint border-2 border-primary'
                    : 'bg-dark-card border-2 border-transparent'
                }`}
                onPress={() => setMotivation(m.value)}
                accessibilityRole="button"
                accessibilityLabel={`${m.label}: ${m.description}`}
                accessibilityState={{ selected: motivation === m.value }}
              >
                <Text className="text-lg font-semibold text-text-primary">{m.label}</Text>
                <Text className="text-sm text-text-secondary mt-1">{m.description}</Text>
              </Pressable>
            ))}

            <View className="flex-row gap-3 mt-6">
              <View className="flex-1">
                <Button label="Back" variant="secondary" onPress={() => setStep('language')} />
              </View>
              <View className="flex-1">
                <Button
                  label="Continue"
                  onPress={() => setStep('level')}
                  disabled={!motivation}
                />
              </View>
            </View>
          </>
        )}

        {step === 'level' && (
          <>
            <Text className="text-[28px] font-bold text-text-primary mb-2" accessibilityRole="header">
              What&apos;s your level?
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              We&apos;ll personalize your experience.
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
                <Button label="Back" variant="secondary" onPress={() => setStep('motivation')} />
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
                  label="Start learning"
                  onPress={handleSaveProfile}
                  loading={saving}
                  disabled={saving}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
    </GradientBackground>
  );
}
