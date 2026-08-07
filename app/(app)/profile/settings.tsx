import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '../../../hooks/useProfile';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/Button';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { colors } from '../../../config/theme';
import { SUPPORTED_LANGUAGES, DAILY_GOALS } from '../../../config/app';
import { supabase } from '../../../lib/supabase';
import { getTargetLanguage } from '../../../lib/language';
import { getReduceMotion, setReduceMotion } from '../../../lib/motion-preference';
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
  const { signOut } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  // null while the profile hasn't loaded — no language is preselected and
  // Save won't overwrite the stored language with a default.
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode | null>(getTargetLanguage(profile));
  const [level, setLevel] = useState<ProficiencyLevel>(profile?.level ?? 'beginner');
  const [dailyGoal, setDailyGoal] = useState(profile?.dailyGoalMinutes ?? 10);
  const [adultMode, setAdultMode] = useState(profile?.adultMode ?? false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reduce motion is device-local and applies the instant it is tapped — it is
  // not part of the profile save. A user turning motion off is usually doing it
  // *because* something on screen is bothering them right now; making them find
  // "Save Changes" first would be the wrong response to that.
  const [reduceMotion, setReduceMotionState] = useState(getReduceMotion);
  const toggleReduceMotion = () => {
    const next = !reduceMotion;
    setReduceMotionState(next);
    setReduceMotion(next).catch(() => {});
  };

  const hasChanges =
    displayName !== (profile?.displayName ?? '') ||
    targetLanguage !== getTargetLanguage(profile) ||
    level !== profile?.level ||
    dailyGoal !== profile?.dailyGoalMinutes ||
    adultMode !== (profile?.adultMode ?? false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        // Only write the language when one is actually selected.
        ...(targetLanguage ? { targetLanguage } : {}),
        level,
        dailyGoalMinutes: dailyGoal,
        adultMode,
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
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text className="text-lg font-semibold text-text-primary ml-3">Settings</Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        className="flex-1 px-4 pt-6"
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Display Name */}
        <Text className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">Display Name</Text>
        <TextInput
          className="bg-dark-card-alt rounded-[14px] px-4 py-4 text-base text-text-primary border border-border-input mb-6"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          placeholderTextColor={colors.text.quaternary}
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
                <Ionicons name="checkmark-circle" size={20} color={colors.league.diamond} style={{ marginLeft: 'auto' }} />
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
                <Ionicons name="checkmark-circle" size={20} color={colors.league.diamond} style={{ position: 'absolute', right: 16, top: 16 }} />
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

        {/* Adult mode — the gamification opt-out. Framed by what it removes,
            because that is the reason an adult learner turns it on. */}
        <Text className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">
          Adult Mode
        </Text>
        <Pressable
          className={`p-4 rounded-2xl mb-8 flex-row items-center ${
            adultMode ? 'bg-primary-tint border-2 border-primary' : 'bg-dark-card border-2 border-transparent'
          }`}
          onPress={() => setAdultMode((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: adultMode }}
          accessibilityLabel="Adult mode"
          accessibilityHint="Turns off hearts, streaks, leagues and XP celebration"
        >
          <Ionicons
            name={adultMode ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={adultMode ? colors.action.accent : colors.text.tertiary}
          />
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-text-primary">
              Turn off game mechanics
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              No hearts, no streaks, no leagues, no XP. Progress is shown as your CEFR level.
              Nothing is lost — your history is kept if you switch back.
            </Text>
          </View>
        </Pressable>

        {/* Motion — WCAG 2.2 SC 2.2.2 (Level A) asks for a mechanism to stop
            auto-starting motion. The OS Reduce Motion switch is honored too;
            this is the in-app equivalent, and either one suppresses motion. */}
        <Text className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">
          Motion
        </Text>
        <Pressable
          className={`p-4 rounded-2xl mb-8 flex-row items-center ${
            reduceMotion ? 'bg-primary-tint border-2 border-primary' : 'bg-dark-card border-2 border-transparent'
          }`}
          onPress={toggleReduceMotion}
          accessibilityRole="switch"
          accessibilityState={{ checked: reduceMotion }}
          accessibilityLabel="Reduce motion"
          accessibilityHint="Stops looping and decorative animation throughout the app"
        >
          <Ionicons
            name={reduceMotion ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={reduceMotion ? colors.action.accent : colors.text.tertiary}
          />
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-text-primary">
              Reduce motion
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Stops looping and celebratory animation. Applies straight away, and
              follows your device&apos;s Reduce Motion setting as well.
            </Text>
          </View>
        </Pressable>

        {/* Save */}
        <Button
          label="Save Changes"
          onPress={handleSave}
          loading={saving}
          disabled={!hasChanges || saving}
        />

        {/* Legal */}
        <View className="mt-10 mb-6">
          <Text className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">Legal</Text>
          <Pressable
            className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center"
            onPress={() => Linking.openURL('https://fluenci.com/privacy')}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.premium.base} />
            <Text className="text-base font-semibold text-text-primary ml-4 flex-1">Privacy Policy</Text>
            <Ionicons name="open-outline" size={18} color={colors.correctionChip.grammar.text} />
          </Pressable>
          <Pressable
            className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center"
            onPress={() => Linking.openURL('https://fluenci.com/terms')}
            accessibilityRole="link"
            accessibilityLabel="Terms of Service"
          >
            <Ionicons name="document-text-outline" size={24} color={colors.premium.base} />
            <Text className="text-base font-semibold text-text-primary ml-4 flex-1">Terms of Service</Text>
            <Ionicons name="open-outline" size={18} color={colors.correctionChip.grammar.text} />
          </Pressable>
        </View>

        {/* Delete Account */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">Danger Zone</Text>
          <Pressable
            className="bg-error-bg py-4 rounded-[14px] items-center"
            disabled={deleting}
            onPress={() => {
              Alert.alert(
                'Delete Account',
                'This will permanently delete your account and all your data. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete My Account',
                    style: 'destructive',
                    onPress: () => {
                      Alert.alert(
                        'Are you absolutely sure?',
                        'All your progress, streaks, and subscription will be lost forever.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Yes, Delete Everything',
                            style: 'destructive',
                            onPress: async () => {
                              setDeleting(true);
                              try {
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                  Alert.alert('Error', 'Please sign in again before deleting your account.');
                                  return;
                                }
                                const res = await supabase.functions.invoke('delete-account', {
                                  headers: { Authorization: `Bearer ${session.access_token}` },
                                });
                                if (res.error) {
                                  // The function fails closed and explains why (e.g. the user still
                                  // owns an organization). Show that instead of a generic error.
                                  let serverMessage: string | null = null;
                                  const context = (res.error as { context?: Response }).context;
                                  if (context && typeof context.json === 'function') {
                                    try {
                                      const body = await context.json();
                                      if (typeof body?.error === 'string') serverMessage = body.error;
                                    } catch {
                                      // Body was not JSON — fall through to the generic message.
                                    }
                                  }
                                  Alert.alert(
                                    'Account Not Deleted',
                                    serverMessage ??
                                      'Failed to delete account. Please try again or contact support.'
                                  );
                                  return;
                                }
                                if (res.data?.hasStoreSubscription) {
                                  Alert.alert(
                                    'Cancel Your Subscription',
                                    'Your account is deleted, but your subscription was purchased through the App Store and must be cancelled there. Open Settings > Apple Account > Subscriptions to cancel it.'
                                  );
                                }
                                await signOut();
                              } catch {
                                Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
                              } finally {
                                setDeleting(false);
                              }
                            },
                          },
                        ]
                      );
                    },
                  },
                ]
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
          >
            <Text className="text-error-dark text-base font-semibold">
              {deleting ? 'Deleting...' : 'Delete Account'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </GradientBackground>
  );
}
