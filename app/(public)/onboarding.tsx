import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, TextInput } from 'react-native';
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

// Dörnyei L2MSS: the learner's vision of themselves as a competent L2 user
// is the single strongest predictor of sustained effort (r ≈ 0.61). The
// language-specific placeholder gives a vivid, concrete anchor instead of
// an abstract prompt. research.md §11.1.
const IDEAL_SELF_PLACEHOLDER: Partial<Record<LanguageCode, string>> = {
  es: 'Ordering coffee in Madrid without switching to English.',
  fr: 'Reading a whole novel in French by next summer.',
  de: 'Understanding the in-jokes at my partner\'s family dinners.',
  it: 'Navigating an Italian road trip with the locals.',
  pt: 'Chatting with my neighbors in Lisbon about football.',
  ja: 'Watching anime without subtitles.',
  ko: 'Singing K-pop and understanding every line.',
  zh: 'Haggling at a Beijing street market.',
  ar: 'Reading Arabic poetry the way it was written.',
  hi: 'Watching Bollywood films without subtitles.',
  ru: 'Reading a Tolstoy short story in the original.',
  en: 'Giving a confident talk at work in English.',
};

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

type Step = 'language' | 'motivation' | 'idealSelf' | 'level' | 'placement' | 'goal';

const ALL_STEPS: Step[] = ['language', 'motivation', 'idealSelf', 'level', 'placement', 'goal'];

const IDEAL_SELF_MAX_CHARS = 300;

export default function OnboardingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { loadUserData, setMotivation: storeSetMotivation } = useAppStore();

  const [step, setStep] = useState<Step>('language');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode | null>(null);
  const [motivation, setMotivation] = useState<MotivationReason | null>(null);
  const [idealL2Self, setIdealL2Self] = useState<string>('');
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
        motivationReason: motivation,
        idealL2Self: idealL2Self.trim() ? idealL2Self.trim() : null,
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
                  onPress={() => setStep('idealSelf')}
                  disabled={!motivation}
                />
              </View>
            </View>
          </>
        )}

        {step === 'idealSelf' && (
          <>
            <Text className="text-[28px] font-bold text-text-primary mb-2" accessibilityRole="header">
              Picture a moment you&apos;d love to have in this language.
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              One sentence is enough. You can skip this if you&apos;d rather not say.
            </Text>

            <View className="bg-dark-card rounded-2xl p-4 mb-4 border border-transparent focus:border-primary">
              <TextInput
                value={idealL2Self}
                onChangeText={(text) => setIdealL2Self(text.slice(0, IDEAL_SELF_MAX_CHARS))}
                placeholder={(targetLanguage && IDEAL_SELF_PLACEHOLDER[targetLanguage]) ?? IDEAL_SELF_PLACEHOLDER.en}
                placeholderTextColor="#6b7280"
                multiline
                numberOfLines={4}
                maxLength={IDEAL_SELF_MAX_CHARS}
                className="text-lg text-text-primary min-h-[100px]"
                style={{ textAlignVertical: 'top' }}
                accessibilityLabel="Your ideal L2 self — a sentence describing your language vision"
              />
              <Text className="text-xs text-text-secondary mt-2 text-right">
                {idealL2Self.length} / {IDEAL_SELF_MAX_CHARS}
              </Text>
            </View>

            <View className="flex-row gap-3 mt-2">
              <View className="flex-1">
                <Button label="Back" variant="secondary" onPress={() => setStep('motivation')} />
              </View>
              <View className="flex-1">
                <Button
                  label={idealL2Self.trim() ? 'Continue' : 'Skip'}
                  onPress={() => setStep('level')}
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
                <Button label="Back" variant="secondary" onPress={() => setStep('idealSelf')} />
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
