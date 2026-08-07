import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import {
  upsertProfile,
  markOnboardingComplete,
  updateOnboardingChecklist,
  updateAvatarConfig,
} from '../../lib/supabase-queries';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../../components/ui/Button';
import { PlacementTest, LEVEL_LABELS } from '../../components/onboarding/PlacementTest';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { Avatar } from '../../components/avatar/Avatar';
import { AvatarCustomizer } from '../../components/avatar/AvatarCustomizer';
import { DEFAULT_AVATAR_CONFIG } from '../../components/avatar/constants';
import { colors } from '../../config/theme';
import { SUPPORTED_LANGUAGES, DAILY_GOALS } from '../../config/app';
import { authErrorCopy } from '../../lib/auth-errors';
import {
  loadPendingOnboarding,
  savePendingOnboarding,
  clearPendingOnboarding,
  isFlushable,
  type PendingOnboarding,
  type PendingOnboardingDraft,
  type PlacementResult,
} from '../../lib/pending-onboarding';
import type {
  LanguageCode,
  ProficiencyLevel,
  MotivationReason,
  AvatarConfig,
} from '../../types';

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

/**
 * The two ways Fluenci can present progress. `adultMode: true` suppresses the
 * pressure mechanics — see lib/adult-mode.ts, which is the single source of
 * truth for what that actually hides.
 */
const MODES: { value: boolean; label: string; description: string }[] = [
  {
    value: false,
    label: 'Gamified',
    description: 'Streaks, hearts, XP and leagues. The nudges that keep most people coming back.',
  },
  {
    value: true,
    label: 'Adult mode',
    description:
      'For people who want to learn, not keep a streak alive. No hearts, no leagues, no XP — your progress is a CEFR level, backed by the work you’ve actually done.',
  },
];

type Step =
  | 'language'
  | 'motivation'
  | 'idealSelf'
  | 'level'
  | 'placement'
  | 'result'
  | 'identity'
  | 'mode'
  | 'goal';

const ALL_STEPS: Step[] = [
  'language',
  'motivation',
  'idealSelf',
  'level',
  'placement',
  'result',
  'identity',
  'mode',
  'goal',
];

const IDEAL_SELF_MAX_CHARS = 300;
const DISPLAY_NAME_MAX_CHARS = 24;

// Smart defaults (DESIGN.md §UX Psychology Principles #1): every picker opens
// pre-selected on the most common choice, so the learner's job is "scan and
// adjust" rather than "fill this out". The CTA always names the current
// selection, so a default is a visible recommendation and never a silent one.
const DEFAULT_LANGUAGE: LanguageCode = 'es';
const DEFAULT_MOTIVATION: MotivationReason = 'travel';
const DEFAULT_LEVEL: ProficiencyLevel = 'beginner';
const DEFAULT_DAILY_GOAL = 10;
/**
 * Gamified is pre-selected because it is the only value that agrees with the
 * DB default (`user_profiles.adult_mode` DEFAULT false), with
 * DEFAULT_GAMIFICATION_VISIBILITY, and with useAdultMode's pre-profile-load
 * fallback. Defaulting the other way would show mechanics for a frame and then
 * hide them. The positioning is carried by the copy, not by a pre-ticked box.
 */
const DEFAULT_ADULT_MODE = false;

/** A band counts as a strength when the learner got most of it right. */
const STRENGTH_THRESHOLD = 0.5;

export default function OnboardingScreen() {
  // `authLoading` matters: useAuth resolves the session asynchronously, so
  // `user` is null on the first render even for a signed-in learner. Treating
  // that null as "signed out" would skip the flush below and drop the learner
  // back into the flow they just finished.
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { loadUserData, setMotivation: storeSetMotivation } = useAppStore();

  // `hydrated` gates the first render until the local draft has been read, so
  // a resumed flow never flashes the defaults first. `flushing` covers the
  // post-signup path where this screen exists only to write the profile.
  const [hydrated, setHydrated] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [startedAt, setStartedAt] = useState<number | undefined>(undefined);
  // Tracked in state rather than hardcoded in `draft`, so the background
  // persist effect below can never overwrite the flag that marks the draft
  // ready to flush.
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  // A flush writes the profile and navigates away; it must happen at most
  // once even if this effect re-runs on a dependency identity change.
  const flushedRef = useRef(false);

  const [step, setStep] = useState<Step>('language');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [motivation, setMotivation] = useState<MotivationReason>(DEFAULT_MOTIVATION);
  const [idealL2Self, setIdealL2Self] = useState<string>('');
  const [level, setLevel] = useState<ProficiencyLevel>(DEFAULT_LEVEL);
  const [placement, setPlacement] = useState<PlacementResult | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number>(DEFAULT_DAILY_GOAL);
  const [adultMode, setAdultMode] = useState<boolean>(DEFAULT_ADULT_MODE);
  const [saving, setSaving] = useState(false);

  const languageName =
    SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage)?.name ?? 'your language';

  /**
   * Write the collected answers into the real profile. Shared by the
   * post-signup flush and by the already-authenticated path (an existing
   * account whose onboarding never finished).
   */
  const writeProfile = useCallback(
    async (userId: string, draft: PendingOnboardingDraft) => {
      await upsertProfile(userId, {
        nativeLanguage: 'en' as LanguageCode,
        targetLanguage: draft.targetLanguage ?? DEFAULT_LANGUAGE,
        level: draft.level ?? DEFAULT_LEVEL,
        dailyGoalMinutes: draft.dailyGoalMinutes ?? DEFAULT_DAILY_GOAL,
        motivationReason: draft.motivation,
        idealL2Self: draft.idealL2Self,
        adultMode: draft.adultMode ?? DEFAULT_ADULT_MODE,
        ...(draft.displayName ? { displayName: draft.displayName } : {}),
      });

      if (draft.avatarConfig) {
        await updateAvatarConfig(userId, draft.avatarConfig);
      }

      await updateOnboardingChecklist(userId, {
        chooseLanguage: true,
        placementTest: !!draft.placement,
        firstLesson: false,
        aiConversation: false,
        dailyReminder: false,
        collapsed: false,
        dismissed: false,
        completedAt: null,
      });
      await markOnboardingComplete(userId);

      // Persist transient motivation in the store so Home's HeroHook can use it.
      storeSetMotivation(draft.motivation);
      await clearPendingOnboarding();
      await loadUserData(userId);
      router.replace('/(app)');
    },
    [loadUserData, router, storeSetMotivation],
  );

  const applyPending = useCallback((pending: PendingOnboarding) => {
    setStartedAt(pending.startedAt);
    setCompletedAt(pending.completedAt);
    if (pending.targetLanguage) setTargetLanguage(pending.targetLanguage);
    if (pending.motivation) setMotivation(pending.motivation);
    if (pending.idealL2Self) setIdealL2Self(pending.idealL2Self);
    if (pending.level) setLevel(pending.level);
    if (pending.placement) setPlacement(pending.placement);
    if (pending.displayName) setDisplayName(pending.displayName);
    if (pending.avatarConfig) setAvatarConfig(pending.avatarConfig);
    if (pending.dailyGoalMinutes) setDailyGoal(pending.dailyGoalMinutes);
    // Explicit typeof check, not truthiness: every other field here is a
    // nullable object or string where `if (x)` is safe, but for a boolean that
    // idiom silently discards a deliberate `false` (Gamified) and resurrects
    // the default. Same value, different meaning — "unanswered" vs "chose it".
    if (typeof pending.adultMode === 'boolean') setAdultMode(pending.adultMode);
  }, []);

  // Mount: read the local draft. If the learner has just signed up and the
  // draft is complete, this screen's only job is to flush it and get out.
  useEffect(() => {
    // Until the session has resolved we cannot tell a signed-out learner from
    // a signed-in one whose session is still loading. Stay on the loader.
    if (authLoading) return;

    let cancelled = false;

    (async () => {
      let pending: PendingOnboarding | null = null;
      try {
        pending = await loadPendingOnboarding();
      } catch (err) {
        console.error('loadPendingOnboarding failed:', err);
      }
      if (cancelled) return;

      if (user && isFlushable(pending) && pending && !flushedRef.current) {
        flushedRef.current = true;
        setFlushing(true);
        try {
          await writeProfile(user.id, pending);
          return;
        } catch (err: unknown) {
          if (cancelled) return;
          flushedRef.current = false;
          console.error('flush pending onboarding failed:', err);
          // Don't strand the learner on a spinner — drop them back into the
          // flow with their answers intact so they can retry the last step.
          Alert.alert(
            'We couldn\'t save your setup',
            'Your answers are still here. Please try again.',
          );
          applyPending(pending);
          setStep('goal');
          setFlushing(false);
          setHydrated(true);
          return;
        }
      }

      if (pending) applyPending(pending);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, writeProfile, applyPending]);

  const draft: PendingOnboardingDraft = useMemo(
    () => ({
      targetLanguage,
      motivation,
      idealL2Self: idealL2Self.trim() ? idealL2Self.trim() : null,
      level,
      placement,
      displayName: displayName.trim() ? displayName.trim() : null,
      avatarConfig,
      dailyGoalMinutes: dailyGoal,
      adultMode,
      completedAt,
    }),
    [targetLanguage, motivation, idealL2Self, level, placement, displayName, avatarConfig, dailyGoal, adultMode, completedAt],
  );

  // Mirror every answer to local storage so a backgrounded or killed app
  // resumes where it left off. Only meaningful pre-auth — and never while the
  // session is still resolving, or this would race the flush above.
  useEffect(() => {
    if (authLoading || !hydrated || user || flushing) return;
    savePendingOnboarding(draft, startedAt).catch((err) => {
      console.error('savePendingOnboarding failed:', err);
    });
  }, [authLoading, hydrated, user, flushing, draft, startedAt]);

  const handleFinish = async () => {
    setSaving(true);
    try {
      if (user) {
        // Already signed in (account existed but onboarding never completed).
        await writeProfile(user.id, draft);
        return;
      }
      // Pre-auth: park the answers and send them to sign-up. The root route
      // guard bounces back here once a session exists, and the mount effect
      // above flushes the draft into the profile.
      const stamp = new Date().toISOString();
      setCompletedAt(stamp);
      await savePendingOnboarding({ ...draft, completedAt: stamp }, startedAt);
      router.replace('/(public)/auth');
    } catch (err: unknown) {
      console.error('handleFinish error:', err);
      // The learner's answers are still in AsyncStorage at this point, so the
      // copy can honestly promise nothing was lost.
      const { title, message } = authErrorCopy(err);
      Alert.alert(title, `${message}\n\nYour answers are saved on this device.`);
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = ALL_STEPS.indexOf(step);
  // Goal gradient (DESIGN.md §UX Psychology Principles #2): the learner is
  // credited for the step they're on, so this never reads 0%.
  const progressPct = Math.round(((stepIndex + 1) / ALL_STEPS.length) * 100);

  const strengths = useMemo(
    () => (placement?.bands ?? []).filter((b) => b.correct / b.total >= STRENGTH_THRESHOLD),
    [placement],
  );
  const focusAreas = useMemo(
    () => (placement?.bands ?? []).filter((b) => b.correct / b.total < STRENGTH_THRESHOLD),
    [placement],
  );

  if (!hydrated || flushing) {
    return (
      <GradientBackground>
        <SafeAreaView className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.action.accent} />
          {flushing && (
            <Text className="text-base text-text-secondary mt-4">Setting up your course…</Text>
          )}
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
    <SafeAreaView className="flex-1">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        className="flex-1 px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step indicator — always shows real, non-zero progress */}
        <View className="mb-8">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-semibold text-text-tertiary">
              Step {stepIndex + 1} of {ALL_STEPS.length}
            </Text>
            <Text className="text-xs font-semibold text-primary">{progressPct}% set up</Text>
          </View>
          <View className="flex-row gap-2">
            {ALL_STEPS.map((s) => {
              const thisIdx = ALL_STEPS.indexOf(s);
              return (
                <View
                  key={s}
                  className={`flex-1 h-1.5 rounded-full ${thisIdx <= stepIndex ? 'bg-primary' : 'bg-dark-card-alt'}`}
                />
              );
            })}
          </View>
        </View>

        {step === 'language' && (
          <>
            <Text className="text-[28px] font-bold text-text-primary mb-2" accessibilityRole="header">
              What language do you want to learn?
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              Spanish is our most popular course — change it any time.
            </Text>

            {SUPPORTED_LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                className={`p-4 rounded-2xl mb-3 flex-row items-center ${
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
              <Button label={`Continue with ${languageName}`} onPress={() => setStep('motivation')} />
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
                className={`p-4 rounded-2xl mb-3 ${
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
                <Button label="Continue" onPress={() => setStep('idealSelf')} />
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
                placeholder={IDEAL_SELF_PLACEHOLDER[targetLanguage] ?? IDEAL_SELF_PLACEHOLDER.en}
                placeholderTextColor={colors.text.quaternary}
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
              Not sure? Leave it — the next step measures it for you.
            </Text>

            {LEVELS.map((l) => (
              <Pressable
                key={l.value}
                className={`p-4 rounded-2xl mb-3 ${
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
                <Button label="Continue" onPress={() => setStep('placement')} />
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
              Ten questions. You&apos;ll get your {languageName} level at the end — free, no account
              needed.
            </Text>
            <PlacementTest
              targetLanguage={targetLanguage}
              onComplete={(result) => {
                setPlacement(result);
                setLevel(result.suggestedLevel);
                setStep('result');
              }}
              onSkip={() => setStep('identity')}
            />
          </>
        )}

        {/*
          Reciprocity (DESIGN.md §UX Psychology Principles #3): the learner
          receives a real, useful assessment here — before any account exists.
          The sign-up later reads as saving something they already own.
        */}
        {step === 'result' && placement && (
          <>
            <Text className="text-[28px] font-bold text-text-primary mb-2" accessibilityRole="header">
              Your {languageName} level
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              Based on the {placement.totalCount} questions you just answered.
            </Text>

            <View className="bg-dark-card rounded-2xl p-5 mb-4 border-2 border-primary items-center">
              <Text className="text-[32px] font-bold text-primary mb-1">
                {LEVEL_LABELS[placement.suggestedLevel]}
              </Text>
              <Text className="text-base text-text-secondary">
                {placement.correctCount} of {placement.totalCount} correct
              </Text>
            </View>

            {strengths.length > 0 && (
              <View className="bg-dark-card rounded-2xl p-4 mb-3">
                <Text className="text-sm font-bold text-success mb-3">WHAT YOU ALREADY HAVE</Text>
                {strengths.map((band) => (
                  <View key={band.level} className="flex-row justify-between mb-2">
                    <Text className="text-base text-text-primary">{LEVEL_LABELS[band.level]}</Text>
                    <Text className="text-base text-text-secondary">
                      {band.correct}/{band.total}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {focusAreas.length > 0 && (
              <View className="bg-dark-card rounded-2xl p-4 mb-3">
                <Text className="text-sm font-bold text-warning mb-3">WHERE WE&apos;LL START</Text>
                {focusAreas.map((band) => (
                  <View key={band.level} className="flex-row justify-between mb-2">
                    <Text className="text-base text-text-primary">{LEVEL_LABELS[band.level]}</Text>
                    <Text className="text-base text-text-secondary">
                      {band.correct}/{band.total}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View className="mt-4">
              <Button label="Continue" onPress={() => setStep('identity')} />
            </View>
            <Pressable
              onPress={() => setStep('placement')}
              className="py-3 items-center mt-1"
              accessibilityRole="button"
              accessibilityLabel="Retake the placement test"
            >
              <Text className="text-sm text-text-secondary">Retake the test</Text>
            </Pressable>
          </>
        )}

        {/*
          IKEA effect (DESIGN.md §UX Psychology Principles #4): the learner
          builds something of their own before the sign-up gate, so leaving
          means abandoning it rather than skipping a form.
        */}
        {step === 'identity' && (
          <>
            <Text className="text-[28px] font-bold text-text-primary mb-2" accessibilityRole="header">
              Make it yours
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              Pick a name and a look. This is who you&apos;ll be in {languageName}.
            </Text>

            <View className="items-center mb-6">
              <Avatar config={avatarConfig} size="large" expression="happy" />
              <Pressable
                onPress={() => setCustomizerOpen(true)}
                className="mt-4 px-5 py-3 rounded-[14px] bg-dark-card-alt"
                accessibilityRole="button"
                accessibilityLabel="Customize your avatar"
              >
                <Text className="text-base font-semibold text-primary">Customize avatar</Text>
              </Pressable>
            </View>

            <View className="bg-dark-card rounded-2xl p-4 mb-4">
              <TextInput
                value={displayName}
                onChangeText={(text) => setDisplayName(text.slice(0, DISPLAY_NAME_MAX_CHARS))}
                placeholder="What should we call you?"
                placeholderTextColor={colors.text.quaternary}
                maxLength={DISPLAY_NAME_MAX_CHARS}
                className="text-lg text-text-primary"
                accessibilityLabel="Your display name"
              />
            </View>

            <View className="flex-row gap-3 mt-2">
              <View className="flex-1">
                <Button
                  label="Back"
                  variant="secondary"
                  onPress={() => setStep(placement ? 'result' : 'placement')}
                />
              </View>
              <View className="flex-1">
                <Button label="Continue" onPress={() => setStep('mode')} />
              </View>
            </View>

            <AvatarCustomizer
              visible={customizerOpen}
              initialConfig={avatarConfig}
              onClose={() => setCustomizerOpen(false)}
              onSave={(config) => {
                setAvatarConfig(config);
                setCustomizerOpen(false);
              }}
            />
          </>
        )}

        {step === 'mode' && (
          <>
            <Text className="text-[28px] font-bold text-text-primary mb-2" accessibilityRole="header">
              How should Fluenci push you?
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              Same lessons either way. This changes what the app shows you — and you can switch
              whenever you like.
            </Text>

            {MODES.map((m) => (
              <Pressable
                key={m.label}
                className={`p-4 rounded-2xl mb-3 ${
                  adultMode === m.value
                    ? 'bg-primary-tint border-2 border-primary'
                    : 'bg-dark-card border-2 border-transparent'
                }`}
                onPress={() => setAdultMode(m.value)}
                accessibilityRole="button"
                accessibilityLabel={`${m.label}: ${m.description}`}
                accessibilityState={{ selected: adultMode === m.value }}
              >
                <Text className="text-lg font-semibold text-text-primary">{m.label}</Text>
                <Text className="text-sm text-text-secondary mt-1">{m.description}</Text>
              </Pressable>
            ))}

            <View className="flex-row gap-3 mt-6">
              <View className="flex-1">
                <Button label="Back" variant="secondary" onPress={() => setStep('identity')} />
              </View>
              <View className="flex-1">
                <Button
                  label={`Continue with ${adultMode ? 'Adult mode' : 'Gamified'}`}
                  onPress={() => setStep('goal')}
                />
              </View>
            </View>
          </>
        )}

        {step === 'goal' && (
          <>
            <Text className="text-[28px] font-bold text-text-primary mb-2" accessibilityRole="header">
              {adultMode ? 'How much time do you have?' : 'Set your daily goal'}
            </Text>
            <Text className="text-base text-text-secondary mb-6">
              {adultMode
                ? 'This sets the length of your daily session. Nothing breaks if you skip a day.'
                : 'Ten minutes a day is what most learners pick. You can change it later.'}
            </Text>

            {DAILY_GOALS.map((goal) => (
              <Pressable
                key={goal}
                className={`p-4 rounded-2xl mb-3 flex-row items-center justify-between ${
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
                {/* Labels describe the commitment, not the learner. The scale
                    used to end at "Insane", which dares the user into a budget
                    they will miss — and a missed daily goal is the first step
                    out of the habit. Adult mode drops them entirely: a time
                    budget is a practical choice, not a measure of seriousness. */}
                {!adultMode && goal === 5 && <Text className="text-sm text-text-secondary">A few minutes</Text>}
                {!adultMode && goal === 10 && <Text className="text-sm text-text-secondary">Most popular</Text>}
                {!adultMode && goal === 15 && <Text className="text-sm text-text-secondary">Steady</Text>}
                {!adultMode && goal === 20 && <Text className="text-sm text-text-secondary">Committed</Text>}
                {!adultMode && goal === 30 && <Text className="text-sm text-text-secondary">Intensive</Text>}
              </Pressable>
            ))}

            <View className="flex-row gap-3 mt-6">
              <View className="flex-1">
                <Button label="Back" variant="secondary" onPress={() => setStep('mode')} />
              </View>
              <View className="flex-1">
                <Button
                  label={user ? 'Start learning' : 'Save my progress'}
                  onPress={handleFinish}
                  loading={saving}
                  disabled={saving}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </GradientBackground>
  );
}
