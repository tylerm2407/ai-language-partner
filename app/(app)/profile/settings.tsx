import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSafeBack } from '../../../hooks/useSafeBack';
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
import { getHapticsEnabled, setHapticsEnabled, haptic } from '../../../lib/haptics';
import { revokeAllAiConsent } from '../../../lib/ai-consent';
import { cefrBandForProficiencyLevel } from '../../../lib/cefr-proficiency';
import { cefrCanDo } from '../../../lib/cefr-labels';
import type { LanguageCode, ProficiencyLevel } from '../../../types';

const LEVELS: { value: ProficiencyLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'elementary', label: 'Elementary' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'upper_intermediate', label: 'Upper Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

/** What each option actually commits the learner to, in the same words the rest
 *  of the app uses for a level. "Upper Intermediate" is a name, not a claim —
 *  this is the claim, and it is what the content difficulty is keyed on. */
function levelCanDo(level: ProficiencyLevel): string {
  return cefrCanDo(cefrBandForProficiencyLevel(level));
}

export default function SettingsScreen() {
  const goBack = useSafeBack('/(app)');
  const { profile, updateProfile } = useProfile();
  const { signOut, user } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  // null while the profile hasn't loaded — no language is preselected and
  // Save won't overwrite the stored language with a default.
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode | null>(getTargetLanguage(profile));
  const [level, setLevel] = useState<ProficiencyLevel>(profile?.level ?? 'beginner');
  const [dailyGoal, setDailyGoal] = useState(profile?.dailyGoalMinutes ?? 10);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reduce motion is device-local and applies the instant it is tapped — it is
  // not part of the profile save. A user turning motion off is usually doing it
  // *because* something on screen is bothering them right now; making them find
  // "Save Changes" first would be the wrong response to that.
  const [reduceMotion, setReduceMotionState] = useState(getReduceMotion);

  // Device-local for the same reasons as reduce motion, and a separate switch
  // from it on purpose: someone who turns motion off to stop the screen moving
  // has said nothing about whether they want the phone to buzz.
  const [hapticsOn, setHapticsOnState] = useState(getHapticsEnabled);
  const toggleHaptics = () => {
    const next = !hapticsOn;
    setHapticsOnState(next);
    setHapticsEnabled(next).catch(() => {});
    // Turning them on demonstrates what was just enabled. Turning them off
    // cannot answer back, which is the correct silence.
    if (next) haptic('confirm');
  };
  const toggleReduceMotion = () => {
    const next = !reduceMotion;
    setReduceMotionState(next);
    setReduceMotion(next).catch(() => {});
  };

  const hasChanges =
    displayName !== (profile?.displayName ?? '') ||
    targetLanguage !== getTargetLanguage(profile) ||
    level !== profile?.level ||
    dailyGoal !== profile?.dailyGoalMinutes;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        // Only write the language when one is actually selected.
        ...(targetLanguage ? { targetLanguage } : {}),
        level,
        dailyGoalMinutes: dailyGoal,
      });
      goBack();
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
        <Pressable onPress={() => goBack()} accessibilityRole="button" accessibilityLabel="Go back">
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
              accessibilityLabel={`${l.label}. ${levelCanDo(l.value)}`}
              accessibilityState={{ selected: level === l.value }}
            >
              <Text className="text-base font-semibold text-text-primary">{l.label}</Text>
              <Text className="text-sm text-text-secondary mt-0.5 pr-8">{levelCanDo(l.value)}</Text>
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

        {/* Motion — WCAG 2.2 SC 2.2.2 (Level A) asks for a mechanism to stop
            auto-starting motion. The OS Reduce Motion switch is honored too;
            this is the in-app equivalent, and either one suppresses motion. */}
        <Text className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">
          Motion
        </Text>
        <Pressable
          className={`p-4 rounded-2xl mb-6 flex-row items-center ${
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

        {/* Haptics — deliberately its own control rather than something folded
            into Reduce motion. Vibration is a distinct sense with distinct
            reasons to want it off: tactile sensitivity, a quiet lecture hall, a
            phone resting on a hard desk. There is no OS-wide switch we can
            read for it the way `useMotion` reads Reduce Motion, so this is the
            only mechanism the learner has. */}
        <Text className="text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">
          Haptics
        </Text>
        <Pressable
          className={`p-4 rounded-2xl mb-8 flex-row items-center ${
            hapticsOn ? 'bg-primary-tint border-2 border-primary' : 'bg-dark-card border-2 border-transparent'
          }`}
          onPress={toggleHaptics}
          accessibilityRole="switch"
          accessibilityState={{ checked: hapticsOn }}
          accessibilityLabel="Vibration"
          accessibilityHint="Turns off every vibration the app produces"
        >
          <Ionicons
            name={hapticsOn ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={hapticsOn ? colors.action.accent : colors.text.tertiary}
          />
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-text-primary">
              Vibration
            </Text>
            <Text className="text-sm text-text-secondary mt-0.5">
              Buzzes on answers, button presses and when you finish something.
              Turning this off silences all of them. Applies straight away.
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

          {/* Withdrawing consent must be as easy as granting it (Apple 5.1.1(ii)),
              so it lives here rather than behind a support request. */}
          <Pressable
            className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-center"
            onPress={() => {
              Alert.alert(
                'Withdraw AI consent',
                'You’ll be asked again the next time you use the AI tutor or your microphone. Nothing already saved to your account is removed — use Delete Account for that.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Withdraw',
                    style: 'destructive',
                    onPress: async () => {
                      if (!user?.id) return;
                      try {
                        await revokeAllAiConsent(user.id);
                        Alert.alert('Consent withdrawn', 'We’ll ask again next time.');
                      } catch {
                        Alert.alert(
                          'Could not withdraw consent',
                          'Something went wrong saving that. Please try again.',
                        );
                      }
                    },
                  },
                ],
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="Withdraw AI consent"
          >
            <Ionicons name="hand-left-outline" size={24} color={colors.premium.base} />
            <View className="ml-4 flex-1">
              <Text className="text-base font-semibold text-text-primary">Withdraw AI consent</Text>
              <Text className="text-sm text-text-tertiary mt-0.5">
                Stop sending messages and audio to our AI providers
              </Text>
            </View>
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
                        'All your progress and subscription will be lost forever.',
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
