import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '../../../hooks/useProfile';
import { Button } from '../../../components/ui/Button';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { SUPPORTED_LANGUAGES, DAILY_GOALS } from '../../../config/app';
import type { LanguageCode, ProficiencyLevel } from '../../../types';

const LEVELS: { value: ProficiencyLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'elementary', label: 'Elementary' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'upper_intermediate', label: 'Upper Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, updateProfile } = useProfile();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(profile?.targetLanguage ?? 'es');
  const [level, setLevel] = useState<ProficiencyLevel>(profile?.level ?? 'beginner');
  const [dailyGoal, setDailyGoal] = useState(profile?.dailyGoalMinutes ?? 10);
  const [saving, setSaving] = useState(false);

  const hasChanges =
    displayName !== (profile?.displayName ?? '') ||
    targetLanguage !== profile?.targetLanguage ||
    level !== profile?.level ||
    dailyGoal !== profile?.dailyGoalMinutes;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        targetLanguage,
        level,
        dailyGoalMinutes: dailyGoal,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <GradientBackground>
    <SafeAreaView className="flex-1">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-dark-border">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color="#F1F5F9" />
        </Pressable>
        <Text className="text-lg font-semibold text-text-primary ml-3">Settings</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Display Name */}
        <Text className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">Display Name</Text>
        <TextInput
          className="bg-dark-card-alt rounded-[14px] px-4 py-4 text-base text-text-primary border border-border-input mb-6"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          placeholderTextColor="#64748B"
          autoCapitalize="words"
          accessibilityLabel="Display name"
        />

        {/* Target Language */}
        <Text className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">Target Language</Text>
        <View className="mb-6">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <Pressable
              key={lang.code}
              className={`p-4 rounded-2xl mb-2 flex-row items-center ${
                targetLanguage === lang.code
                  ? 'bg-primary-tint border-2 border-primary'
                  : 'bg-dark-card border-2 border-transparent'
              }`}
              onPress={() => setTargetLanguage(lang.code as LanguageCode)}
              accessibilityRole="button"
              accessibilityState={{ selected: targetLanguage === lang.code }}
            >
              <Text className="text-xl mr-3">{lang.flag}</Text>
              <Text className="text-base font-semibold text-text-primary">{lang.name}</Text>
              {targetLanguage === lang.code && (
                <Ionicons name="checkmark-circle" size={20} color="#38BDF8" style={{ marginLeft: 'auto' }} />
              )}
            </Pressable>
          ))}
        </View>

        {/* Level */}
        <Text className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">Proficiency Level</Text>
        <View className="mb-6">
          {LEVELS.map((l) => (
            <Pressable
              key={l.value}
              className={`p-4 rounded-2xl mb-2 ${
                level === l.value
                  ? 'bg-primary-tint border-2 border-primary'
                  : 'bg-dark-card border-2 border-transparent'
              }`}
              onPress={() => setLevel(l.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: level === l.value }}
            >
              <Text className="text-base font-semibold text-text-primary">{l.label}</Text>
              {level === l.value && (
                <Ionicons name="checkmark-circle" size={20} color="#38BDF8" style={{ position: 'absolute', right: 16, top: 16 }} />
              )}
            </Pressable>
          ))}
        </View>

        {/* Daily Goal */}
        <Text className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">Daily Goal</Text>
        <View className="flex-row gap-2 mb-8">
          {DAILY_GOALS.map((goal) => (
            <Pressable
              key={goal}
              className={`flex-1 py-3 rounded-[14px] items-center ${
                dailyGoal === goal
                  ? 'bg-primary'
                  : 'bg-dark-card border border-dark-border'
              }`}
              onPress={() => setDailyGoal(goal)}
              accessibilityRole="button"
              accessibilityState={{ selected: dailyGoal === goal }}
            >
              <Text className={`text-base font-semibold ${dailyGoal === goal ? 'text-white' : 'text-text-primary'}`}>
                {goal}
              </Text>
              <Text className={`text-xs ${dailyGoal === goal ? 'text-white/70' : 'text-text-tertiary'}`}>
                min
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Save */}
        <Button
          label="Save Changes"
          onPress={handleSave}
          loading={saving}
          disabled={!hasChanges || saving}
        />
      </ScrollView>
    </SafeAreaView>
    </GradientBackground>
  );
}
