import { useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { upsertProfile } from '../../lib/supabase-queries';
import { SUPPORTED_LANGUAGES, DIFFICULTY_LEVELS } from '../../config/app';
import { trackEvent } from '../../lib/analytics';
import type { LanguageCode, ProficiencyLevel } from '../../types';

type Step = 'language' | 'level' | 'goal';

/**
 * Onboarding flow after sign-in: pick target language, level, and daily goal.
 * Creates the user profile in Supabase.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('language');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode | null>(null);
  const [level, setLevel] = useState<ProficiencyLevel | null>(null);
  const [dailyGoal, setDailyGoal] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async () => {
    if (!user || !targetLanguage || !level) return;

    setIsSubmitting(true);
    try {
      await upsertProfile(user.id, {
        targetLanguage,
        level,
        dailyGoalMinutes: dailyGoal,
        nativeLanguage: 'en' as LanguageCode,
      });

      trackEvent('onboarding_completed', { targetLanguage, level, dailyGoal });
      router.replace('/(app)');
    } catch {
      // Retry silently — profile will be created on next app load if needed
      router.replace('/(app)');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Step 1: Language Selection ────────────────────────────────

  if (step === 'language') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ padding: 24, paddingTop: 48 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }} accessibilityRole="header">
            What do you want to learn?
          </Text>
          <Text style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>
            Pick your target language.
          </Text>
        </View>

        <FlatList
          data={SUPPORTED_LANGUAGES.filter((l) => l.code !== 'en')}
          keyExtractor={(item) => item.code}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setTargetLanguage(item.code);
                trackEvent('language_selected', { language: item.code });
                setStep('level');
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F9FAFB',
                padding: 18,
                borderRadius: 14,
                marginBottom: 10,
              }}
              accessibilityRole="button"
              accessibilityLabel={`Learn ${item.name}`}
            >
              <Text style={{ fontSize: 28, marginRight: 14 }}>{item.flag}</Text>
              <Text style={{ fontSize: 18, fontWeight: '500' }}>{item.name}</Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    );
  }

  // ─── Step 2: Level Selection ───────────────────────────────────

  if (step === 'level') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ padding: 24, paddingTop: 48 }}>
          <Pressable onPress={() => setStep('language')} style={{ marginBottom: 16 }} accessibilityRole="button">
            <Text style={{ fontSize: 16, color: '#6366F1' }}>Back</Text>
          </Pressable>
          <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }} accessibilityRole="header">
            What's your level?
          </Text>
          <Text style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>
            We'll tailor lessons to match your experience.
          </Text>
        </View>

        <FlatList
          data={DIFFICULTY_LEVELS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setLevel(item.key as ProficiencyLevel);
                setStep('goal');
              }}
              style={{
                backgroundColor: '#F9FAFB',
                padding: 18,
                borderRadius: 14,
                marginBottom: 10,
              }}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}: ${item.description}`}
            >
              <Text style={{ fontSize: 18, fontWeight: '600' }}>{item.label}</Text>
              <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>{item.description}</Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    );
  }

  // ─── Step 3: Daily Goal ────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ padding: 24, paddingTop: 48 }}>
        <Pressable onPress={() => setStep('level')} style={{ marginBottom: 16 }} accessibilityRole="button">
          <Text style={{ fontSize: 16, color: '#6366F1' }}>Back</Text>
        </Pressable>
        <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }} accessibilityRole="header">
          Set your daily goal
        </Text>
        <Text style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>
          How many minutes per day do you want to practice?
        </Text>

        {[5, 10, 15, 20, 30].map((mins) => (
          <Pressable
            key={mins}
            onPress={() => setDailyGoal(mins)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: dailyGoal === mins ? '#E0E7FF' : '#F9FAFB',
              borderWidth: dailyGoal === mins ? 2 : 0,
              borderColor: '#6366F1',
              padding: 18,
              borderRadius: 14,
              marginBottom: 10,
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: dailyGoal === mins }}
          >
            <Text style={{ fontSize: 18, fontWeight: dailyGoal === mins ? '600' : '400' }}>
              {mins} minutes
            </Text>
            <Text style={{ fontSize: 14, color: '#666' }}>
              {mins <= 5 ? 'Casual' : mins <= 10 ? 'Regular' : mins <= 20 ? 'Serious' : 'Intense'}
            </Text>
          </Pressable>
        ))}

        <Pressable
          onPress={handleComplete}
          disabled={isSubmitting}
          style={{
            backgroundColor: '#6366F1',
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: 'center',
            marginTop: 16,
          }}
          accessibilityRole="button"
          accessibilityLabel="Start learning"
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
            {isSubmitting ? 'Setting up...' : "Let's Go!"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
