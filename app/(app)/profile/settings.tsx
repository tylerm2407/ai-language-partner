import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSafeBack } from '../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '../../../hooks/useProfile';
import { useAuth } from '../../../hooks/useAuth';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { Ui2Header } from '../../../components/ui2/Ui2Header';
import { Ui2Input } from '../../../components/ui2/Ui2Input';
import { Ui2ListRow } from '../../../components/ui2/Ui2ListRow';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to. `spacing` and
// `radii` are plain scheme-independent numbers.
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { radii, spacing } from '../../../config/theme';
import { SUPPORTED_LANGUAGES, DAILY_GOALS } from '../../../config/app';
import { supabase } from '../../../lib/supabase';
import { getTargetLanguage } from '../../../lib/language';
import { getReduceMotion, setReduceMotion } from '../../../lib/motion-preference';
import { getHapticsEnabled, setHapticsEnabled, haptic } from '../../../lib/haptics';
import { revokeAllAiConsent } from '../../../lib/ai-consent';
import { cefrBandForProficiencyLevel } from '../../../lib/cefr-proficiency';
import { cefrCanDo } from '../../../lib/cefr-labels';
import type { LanguageCode, ProficiencyLevel } from '../../../types';
import { SentrySmokeTrigger } from '../../../components/debug/SentrySmokeTrigger';

/** Matches the `ideal_l2_self` column check (migration 028) and onboarding. */
const IDEAL_SELF_MAX = 300;

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
  const { c } = useUi2Theme();
  const goBack = useSafeBack('/(app)');
  const { profile, updateProfile } = useProfile();
  const { signOut, user } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  // null while the profile hasn't loaded — no language is preselected and
  // Save won't overwrite the stored language with a default.
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode | null>(getTargetLanguage(profile));
  const [level, setLevel] = useState<ProficiencyLevel>(profile?.level ?? 'beginner');
  const [dailyGoal, setDailyGoal] = useState(profile?.dailyGoalMinutes ?? 10);
  // The onboarding "picture a moment" answer. Until now it was write-once: the
  // goal-track error copy on the Learn tab has pointed learners here to
  // rewrite it for months, at a control that did not exist.
  const [idealSelf, setIdealSelf] = useState(profile?.idealL2Self ?? '');
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
    dailyGoal !== profile?.dailyGoalMinutes ||
    idealSelf.trim() !== (profile?.idealL2Self ?? '');

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        // Only write the language when one is actually selected.
        ...(targetLanguage ? { targetLanguage } : {}),
        level,
        dailyGoalMinutes: dailyGoal,
        // Empty clears it: a learner is allowed to have no stated goal, and the
        // reminder and hero copy fall back to their generic lines.
        idealL2Self: idealSelf.trim() || null,
      });
      goBack();
    } catch {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
    <SafeAreaView className="flex-1">
      <Ui2Header title="Settings" onBack={() => goBack()} />

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
        <Text className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: c.muted }}>Display Name</Text>
        <Ui2Input
          containerStyle={{ marginBottom: spacing.lg }}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          autoCapitalize="words"
          accessibilityLabel="Display name"
        />

        {/* Target Language */}
        <Text className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: c.muted }}>Target Language</Text>
        <View className="mb-6">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <Pressable
              key={lang.code}
              className="p-4 rounded-2xl mb-2 flex-row items-center"
              style={{
                borderWidth: 2,
                backgroundColor: targetLanguage === lang.code ? c.primaryTint : c.card,
                borderColor: targetLanguage === lang.code ? c.primary : c.cardBorder,
              }}
              onPress={() => setTargetLanguage(lang.code as LanguageCode)}
              accessibilityRole="button"
              accessibilityState={{ selected: targetLanguage === lang.code }}
            >
              <Text className="text-xl mr-3">{lang.flag}</Text>
              <Text className="text-base font-semibold" style={{ color: c.ink }}>{lang.name}</Text>
              {targetLanguage === lang.code && (
                <Ionicons name="checkmark-circle" size={20} color={c.onTint} style={{ marginLeft: 'auto' }} />
              )}
            </Pressable>
          ))}
        </View>

        {/* Level */}
        <Text className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: c.muted }}>Proficiency Level</Text>
        <View className="mb-6">
          {LEVELS.map((l) => (
            <Pressable
              key={l.value}
              className="p-4 rounded-2xl mb-2"
              style={{
                borderWidth: 2,
                backgroundColor: level === l.value ? c.primaryTint : c.card,
                borderColor: level === l.value ? c.primary : c.cardBorder,
              }}
              onPress={() => setLevel(l.value)}
              accessibilityRole="button"
              accessibilityLabel={`${l.label}. ${levelCanDo(l.value)}`}
              accessibilityState={{ selected: level === l.value }}
            >
              <Text className="text-base font-semibold" style={{ color: c.ink }}>{l.label}</Text>
              <Text className="text-sm mt-0.5 pr-8" style={{ color: c.muted }}>{levelCanDo(l.value)}</Text>
              {level === l.value && (
                <Ionicons name="checkmark-circle" size={20} color={c.onTint} style={{ position: 'absolute', right: 16, top: 16 }} />
              )}
            </Pressable>
          ))}
        </View>

        {/* Daily Goal */}
        <Text className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: c.muted }}>Daily Goal</Text>
        <View className="flex-row gap-2 mb-8">
          {DAILY_GOALS.map((goal) => (
            <Pressable
              key={goal}
              className="flex-1 py-3 rounded-[14px] items-center"
              style={{
                borderWidth: 1,
                backgroundColor: dailyGoal === goal ? c.primary : c.card,
                borderColor: dailyGoal === goal ? c.primary : c.cardBorder,
              }}
              onPress={() => setDailyGoal(goal)}
              accessibilityRole="button"
              accessibilityState={{ selected: dailyGoal === goal }}
            >
              <Text
                className="text-base font-semibold"
                style={{ color: dailyGoal === goal ? c.onPrimary : c.ink }}
              >
                {goal}
              </Text>
              <Text
                className="text-xs"
                style={{ color: dailyGoal === goal ? c.onPrimaryMuted : c.idle }}
              >
                min
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Your goal — the Ideal L2 Self (Dörnyei). Drives the session hero
            line, the daily reminder and the generated goal track, so editing
            it is the single most personal control in the app. */}
        <Text className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: c.muted }}>Your Goal</Text>
        <Ui2Input
          containerStyle={{ marginBottom: spacing.lg }}
          value={idealSelf}
          onChangeText={(t) => setIdealSelf(t.slice(0, IDEAL_SELF_MAX))}
          placeholder="Picture a moment you'd love to have in this language…"
          helper={`${idealSelf.length}/${IDEAL_SELF_MAX} · Shapes your session line, your reminders and your goal lessons.`}
          multiline
          numberOfLines={3}
          maxLength={IDEAL_SELF_MAX}
          textAlignVertical="top"
          inputStyle={{ minHeight: 88 }}
          accessibilityLabel="Your goal"
          accessibilityHint="A sentence about the moment you are learning for. Used to personalise your practice."
        />

        {/* Motion — WCAG 2.2 SC 2.2.2 (Level A) asks for a mechanism to stop
            auto-starting motion. The OS Reduce Motion switch is honored too;
            this is the in-app equivalent, and either one suppresses motion. */}
        <Text className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: c.muted }}>
          Motion
        </Text>
        <Pressable
          className="p-4 rounded-2xl mb-6 flex-row items-center"
          style={{
            borderWidth: 2,
            backgroundColor: reduceMotion ? c.primaryTint : c.card,
            borderColor: reduceMotion ? c.primary : c.cardBorder,
          }}
          onPress={toggleReduceMotion}
          accessibilityRole="switch"
          accessibilityState={{ checked: reduceMotion }}
          accessibilityLabel="Reduce motion"
          accessibilityHint="Stops looping and decorative animation throughout the app"
        >
          <Ionicons
            name={reduceMotion ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={reduceMotion ? c.onTint : c.idle}
          />
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold" style={{ color: c.ink }}>
              Reduce motion
            </Text>
            <Text className="text-sm mt-0.5" style={{ color: c.muted }}>
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
        <Text className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: c.muted }}>
          Haptics
        </Text>
        <Pressable
          className="p-4 rounded-2xl mb-8 flex-row items-center"
          style={{
            borderWidth: 2,
            backgroundColor: hapticsOn ? c.primaryTint : c.card,
            borderColor: hapticsOn ? c.primary : c.cardBorder,
          }}
          onPress={toggleHaptics}
          accessibilityRole="switch"
          accessibilityState={{ checked: hapticsOn }}
          accessibilityLabel="Vibration"
          accessibilityHint="Turns off every vibration the app produces"
        >
          <Ionicons
            name={hapticsOn ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={hapticsOn ? c.onTint : c.idle}
          />
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold" style={{ color: c.ink }}>
              Vibration
            </Text>
            <Text className="text-sm mt-0.5" style={{ color: c.muted }}>
              Buzzes on answers, button presses and when you finish something.
              Turning this off silences all of them. Applies straight away.
            </Text>
          </View>
        </Pressable>

        {/* Save */}
        <SlabButton
          label="Save Changes"
          arrow={false}
          onPress={handleSave}
          loading={saving}
          disabled={!hasChanges || saving}
        />

        {/* Legal */}
        <View className="mt-10 mb-6">
          <Text className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: c.muted }}>Legal</Text>
          <Ui2ListRow
            style={{ marginBottom: spacing.sm }}
            icon="shield-checkmark-outline"
            title="Privacy Policy"
            role="link"
            onPress={() => Linking.openURL('https://fluenciapp.com/privacy')}
            accessibilityLabel="Privacy Policy"
          />
          <Ui2ListRow
            style={{ marginBottom: spacing.sm }}
            icon="document-text-outline"
            title="Terms of Service"
            role="link"
            onPress={() => Linking.openURL('https://fluenciapp.com/terms')}
            accessibilityLabel="Terms of Service"
          />

          {/* Withdrawing consent must be as easy as granting it (Apple 5.1.1(ii)),
              so it lives here rather than behind a support request. */}
          <Ui2ListRow
            style={{ marginBottom: spacing.sm }}
            icon="hand-left-outline"
            title="Withdraw AI consent"
            subtitle="Stop sending messages and audio to our AI providers"
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
            accessibilityLabel="Withdraw AI consent"
          />
        </View>

        {/* Delete Account */}
        <View className="mb-4">
          <Text className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ color: c.muted }}>Danger Zone</Text>
          <Pressable
            className="py-4 items-center"
            style={{
              borderRadius: radii.lg,
              borderWidth: 2,
              backgroundColor: c.pinkTint,
              borderColor: c.error,
            }}
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
            <Text className="text-base font-semibold" style={{ color: c.error }}>
              {deleting ? 'Deleting...' : 'Delete Account'}
            </Text>
          </Pressable>
        </View>
        <SentrySmokeTrigger />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </View>
  );
}
