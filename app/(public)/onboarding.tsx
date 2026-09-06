import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import {
  upsertProfile,
  markOnboardingComplete,
  updateOnboardingChecklist,
  setAvatarKind,
  incrementXpIdempotent,
} from '../../lib/supabase-queries';
import { useAppStore } from '../../stores/useAppStore';
import { LessonRunner, type LessonResult } from '../../components/lesson/LessonRunner';
import { Ui2Screen } from '../../components/ui2/Ui2Screen';
import { SlabButton } from '../../components/ui2/SlabButton';
import { SlabCard } from '../../components/ui2/SlabCard';
import { OptionRow } from '../../components/ui2/OptionRow';
import { StepHeader } from '../../components/ui2/StepHeader';
import { SpeechBubble } from '../../components/ui2/SpeechBubble';
import { MascotSol, type MascotMood } from '../../components/ui2/MascotSol';
import { Chip } from '../../components/ui2/Chip';
import { PlanBuilder } from '../../components/ui2/PlanBuilder';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { useMotion } from '../../hooks/useMotion';
import { cefrBandForProficiencyLevel } from '../../lib/cefr-proficiency';
import { cefrCanDo } from '../../lib/cefr-labels';
import {
  trialExercisesFor,
  hasTrialLesson,
  TRIAL_LESSON_ID,
  TRIAL_LESSON_XP,
} from '../../components/onboarding/trial-lesson';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { Avatar } from '../../components/avatar/Avatar';
import { presetUrlFromId, type AvatarPreset } from '../../lib/avatar-presets';
import { haptic } from '../../lib/haptics';
import { AvatarPresetPicker } from '../../components/avatar/AvatarPresetPicker';
import { SUPPORTED_LANGUAGES, DAILY_GOALS } from '../../config/app';
import { authErrorCopy } from '../../lib/auth-errors';
import { trackEvent } from '../../lib/analytics';
import { useScreenView } from '../../hooks/useScreenView';
import {
  loadPendingOnboarding,
  savePendingOnboarding,
  clearPendingOnboarding,
  isFlushable,
  type PendingOnboarding,
  type PendingOnboardingDraft,
  type TrialLessonResult,
} from '../../lib/pending-onboarding';
import type {
  LanguageCode,
  ProficiencyLevel,
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
  ru: 'Reading a Tolstoy short story in the original.',
  en: 'Giving a confident talk at work in English.',
};

/**
 * Tap-to-fill starters for the ideal-self field. A learner who would rather
 * not write from nothing gets a sentence to edit; the language name is
 * substituted so the sentence is already theirs.
 */
const IDEAL_SELF_STARTERS: { tag: string; text: (lang: string) => string }[] = [
  { tag: 'Travel', text: (l) => `Getting around on a trip and never needing English, in ${l}.` },
  { tag: 'Family', text: (l) => `Following the whole conversation at a family dinner in ${l}.` },
  { tag: 'Work', text: (l) => `Running a meeting in ${l} without preparing every line.` },
  { tag: 'Films & music', text: (l) => `Watching a film in ${l} with the subtitles off.` },
  { tag: 'Moving abroad', text: (l) => `Settling in somewhere ${l} is spoken and feeling at home.` },
];

/** Number of lit signal bars per self-reported level, shown on the level rows. */
const LEVEL_BARS: Record<ProficiencyLevel, number> = {
  beginner: 1,
  elementary: 2,
  intermediate: 3,
  upper_intermediate: 4,
  advanced: 5,
};

const LEVELS: { value: ProficiencyLevel; label: string; description: string }[] = [
  { value: 'beginner', label: 'Beginner', description: 'I know a few words' },
  { value: 'elementary', label: 'Elementary', description: 'I can form basic sentences' },
  { value: 'intermediate', label: 'Intermediate', description: 'I can hold simple conversations' },
  { value: 'upper_intermediate', label: 'Upper Intermediate', description: 'I can discuss many topics' },
  { value: 'advanced', label: 'Advanced', description: 'I\'m nearly fluent' },
];

/**
 * Two steps have been removed from this flow, both deliberately.
 *
 * `motivation` (2026-08-08) asked why the learner was here and wrote
 * `user_profiles.motivation_reason`. `idealSelf` asks a sharper version of the
 * same question and is the signal the research actually rests on, so the weaker
 * one went. The column and the `MotivationReason` type are left in place.
 *
 * `mode` (2026-08-28) asked the learner to choose between a gamified and an
 * adult presentation. There is only one presentation now — XP, leagues and
 * celebration-as-reward are gone from the product — so the question described a
 * choice that no longer exists. `user_profiles.adult_mode` is dropped in
 * migration 091; unlike `motivation_reason` there is nothing left to restore.
 */
type Step =
  | 'language'
  | 'idealSelf'
  | 'level'
  | 'identity'
  | 'goal'
  | 'lesson'
  | 'building'
  | 'save';

/**
 * Steps that show the progress header. `lesson` runs full-bleed with the
 * runner's own progress bar — two progress indicators stacked on one screen
 * measure different things and read as a bug — and `save` is the payoff, not
 * another form to fill in.
 */
const ALL_STEPS: Step[] = [
  'language',
  'idealSelf',
  'level',
  'identity',
  'goal',
];

/**
 * Every step in order, including the two that sit outside `ALL_STEPS`.
 *
 * `ALL_STEPS` drives the progress header and deliberately omits `lesson` and
 * `save`. The funnel needs the whole path, or the last two steps — where the
 * learner is closest to converting and so where a drop-off costs most — would
 * be invisible.
 *
 * `building` (the plan-building loader, UI 2.0) is in neither list: it needs
 * no progress header, and it is not a place a learner can decide to leave, so
 * counting it would only pad the funnel.
 */
const FUNNEL_STEPS: Step[] = [
  'language',
  'idealSelf',
  'level',
  'identity',
  'goal',
  'lesson',
  'save',
];

const IDEAL_SELF_MAX_CHARS = 300;
const DISPLAY_NAME_MAX_CHARS = 24;

// Smart defaults (DESIGN.md §UX Psychology Principles #1): every picker opens
// pre-selected on the most common choice, so the learner's job is "scan and
// adjust" rather than "fill this out". The CTA always names the current
// selection, so a default is a visible recommendation and never a silent one.
const DEFAULT_LANGUAGE: LanguageCode = 'es';
const DEFAULT_LEVEL: ProficiencyLevel = 'beginner';
const DEFAULT_DAILY_GOAL = 10;


/** Sol's mood: a base mood per step, with a one-shot cheer on a good tap. */
function useMascotMood(base: MascotMood): [MascotMood, () => void] {
  const [cheering, setCheering] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cheer = useCallback(() => {
    setCheering(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCheering(false), 700);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return [cheering ? 'cheer' : base, cheer];
}

function LevelBars({ lit }: { lit: number }) {
  const { c } = useUi2Theme();
  return (
    <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no">
      {[0, 1, 2, 3, 4].map((k) => (
        <View
          key={k}
          style={[styles.bar, { height: 6 + k * 4, backgroundColor: k < lit ? c.primary : c.idle, opacity: k < lit ? 1 : 0.45 }]}
        />
      ))}
    </View>
  );
}

function FlagTile({ flag }: { flag: string }) {
  const { c } = useUi2Theme();
  return (
    <View style={[styles.flagTile, { backgroundColor: c.surface2 }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={styles.flagGlyph}>{flag}</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  useScreenView('onboarding');
  const { c, type } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const [mood, cheer] = useMascotMood('idle');
  // `authLoading` matters: useAuth resolves the session asynchronously, so
  // `user` is null on the first render even for a signed-in learner. Treating
  // that null as "signed out" would skip the flush below and drop the learner
  // back into the flow they just finished.
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { loadUserData } = useAppStore();

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
  const [idealL2Self, setIdealL2Self] = useState<string>('');
  const [level, setLevel] = useState<ProficiencyLevel>(DEFAULT_LEVEL);
  const [trial, setTrial] = useState<TrialLessonResult | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [avatarPresetId, setAvatarPresetId] = useState<string | null>(null);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number>(DEFAULT_DAILY_GOAL);
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
        idealL2Self: draft.idealL2Self,
        ...(draft.displayName ? { displayName: draft.displayName } : {}),
      });

      if (draft.avatarPresetId) {
        await setAvatarKind(userId, 'preset', draft.avatarPresetId);
      }

      await updateOnboardingChecklist(userId, {
        chooseLanguage: true,
        // The trial lesson happened before this account existed, so nothing
        // server-side recorded it. Ticking it here is the honest reading: the
        // learner HAS finished a lesson, and re-asking them to "complete your
        // first lesson" would deny work they just did.
        firstLesson: !!draft.trial,
        aiConversation: false,
        dailyReminder: false,
        skipped: [],
        dismissed: false,
        completedAt: null,
        celebratedAt: null,
      });
      await markOnboardingComplete(userId);

      // The XP the learner earned in the pre-auth trial. The sign-up screen
      // promised it by name, so it has to land — but it must not block the
      // flush: a failure here costs the learner a number, while a throw would
      // cost them the whole profile write and strand them back in onboarding.
      //
      // Keyed on the trial's completion timestamp, which is stable across
      // retries of the same draft, so the idempotency guard (migration 046)
      // makes a re-run of this flush a no-op rather than a second award.
      if (draft.trial && draft.trial.xpEarned > 0) {
        await incrementXpIdempotent(
          draft.trial.xpEarned,
          `trial-lesson:${draft.trial.completedAt}`,
        ).catch((err) => console.error('[onboarding] trial XP award failed:', err));
      }

      await clearPendingOnboarding();
      await loadUserData(userId);

      // The teaching moment already happened — the trial lesson runs before
      // sign-up now, which is what lets the sign-up be sold as saving progress
      // rather than as a toll gate. What is left after the flush is the one
      // free photo avatar, and then the paywall.
      //
      // ONE navigation, not two. This used to be `replace('/(app)')` followed
      // immediately by `push('/avatar-setup')`, which is two dispatches in the
      // same tick where the first one remounts the whole (app) layout — the
      // push could land on a navigator that was still mounting and be dropped,
      // sending the learner straight to Home and skipping the avatar entirely.
      //
      // The two-step existed so the avatar screen had "something beneath it"
      // for a `router.back()` skip. That reason is stale: avatar-setup's skip
      // is `router.replace('/(app)/plans')`, not `back()`, so it needs nothing
      // underneath. The whole chain is replaces — avatar-setup replaces into
      // plans, plans replaces into Home — which is also what keeps a finished
      // setup step off the back stack.
      router.replace('/(app)/avatar-setup');
    },
    [loadUserData, router],
  );

  const applyPending = useCallback((pending: PendingOnboarding) => {
    setStartedAt(pending.startedAt);
    setCompletedAt(pending.completedAt);
    if (pending.targetLanguage) setTargetLanguage(pending.targetLanguage);
    if (pending.idealL2Self) setIdealL2Self(pending.idealL2Self);
    if (pending.level) setLevel(pending.level);
    if (pending.trial) setTrial(pending.trial);
    if (pending.displayName) setDisplayName(pending.displayName);
    if (pending.avatarPresetId) setAvatarPresetId(pending.avatarPresetId);
    if (pending.dailyGoalMinutes) setDailyGoal(pending.dailyGoalMinutes);
    // Explicit typeof check, not truthiness: every other field here is a
    // nullable object or string where `if (x)` is safe, but for a boolean that
    // idiom silently discards a deliberate `false` (Gamified) and resurrects
    // the default. Same value, different meaning — "unanswered" vs "chose it".
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

      // isFlushable now also requires the draft to have been claimed by THIS
      // account at sign-in — a draft left behind by someone else on a shared
      // device must not be written into this profile.
      if (user && isFlushable(pending, user.id) && pending && !flushedRef.current) {
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
          setStep('save');
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
      idealL2Self: idealL2Self.trim() ? idealL2Self.trim() : null,
      level,
      trial,
      displayName: displayName.trim() ? displayName.trim() : null,
      avatarPresetId,
      dailyGoalMinutes: dailyGoal,
      completedAt,
    }),
    [targetLanguage, idealL2Self, level, trial, displayName, avatarPresetId, dailyGoal, completedAt],
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
        // Fired on the successful write rather than on the tap. The Finish
        // control is a <Button>, so the tap has already ticked; this is the
        // setup being accepted, and it must not fire on the error path below.
        haptic('complete');
        // Same rule for the event: the funnel's last step must mean "the
        // profile was written", not "they pressed the button". Counting taps
        // here would hide exactly the failures worth knowing about.
        trackEvent('onboarding_completed', {
          language: targetLanguage,
          band: level,
          count: Math.round((Date.now() - (startedAt ?? Date.now())) / 1000),
        });
        return;
      }
      // Pre-auth: park the answers and send them to sign-up. The root route
      // guard bounces back here once a session exists, and the mount effect
      // above flushes the draft into the profile.
      const stamp = new Date().toISOString();
      setCompletedAt(stamp);
      await savePendingOnboarding({ ...draft, completedAt: stamp }, startedAt);
      haptic('complete');
      // The pre-auth path completes onboarding but has no account yet, so the
      // profile write happens later on the flush. This is still the end of the
      // onboarding funnel — the sign-up that follows is its own step, and
      // conflating them would hide learners lost between the two.
      trackEvent('onboarding_completed', {
        language: targetLanguage,
        band: level,
        count: Math.round((Date.now() - (startedAt ?? Date.now())) / 1000),
      });
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

  /**
   * The trial exercises, resolved once. Recomputing them on every render would
   * hand LessonRunner a new array identity each time, which re-fires its
   * prefetch and restore effects mid-lesson.
   */
  const trialExercises = useMemo(() => trialExercisesFor(targetLanguage), [targetLanguage]);
  const trialAvailable = hasTrialLesson(targetLanguage);

  /**
   * Record the trial result, then move to the sign-up ask. The result rides
   * into the account on the pending draft: nothing about this run exists
   * server-side, because there is no account to attach it to yet.
   *
   * XP is taken from the runner rather than from TRIAL_LESSON_XP so the number
   * on the next screen is the one the celebration just showed.
   */
  const handleTrialComplete = useCallback(async (result: LessonResult) => {
    setTrial({
      xpEarned: result.xpEarned,
      correctCount: result.correctCount,
      totalCount: result.totalExercises,
      completedAt: new Date().toISOString(),
    });
  }, []);

  // One effect rather than instrumenting a dozen setStep call sites: this
  // records every ARRIVAL at a step however it happened, including going back,
  // and cannot drift out of step with a button somebody adds later.
  //
  // Gated on `hydrated` because the draft is read asynchronously — firing
  // before it lands would report 'language' for a learner who is actually
  // resuming at step four, and quietly invent a drop-off that never happened.
  useEffect(() => {
    if (!hydrated || step === 'building') return;
    trackEvent('onboarding_step_viewed', {
      stepName: step,
      step: FUNNEL_STEPS.indexOf(step) + 1,
      count: FUNNEL_STEPS.length,
      language: targetLanguage,
    });
  }, [step, hydrated, targetLanguage]);

  const stepIndex = ALL_STEPS.indexOf(step);
  const band = cefrBandForProficiencyLevel(level);
  const enter = (i: number) => (shouldReduce ? undefined : FadeInDown.delay(80 + i * 40).duration(360));

  if (!hydrated || flushing) {
    return (
      <Ui2Screen fixed>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.primary} />
          {flushing && (
            <Text style={{ fontFamily: type.uiBold, fontSize: 15, color: c.muted, marginTop: 16 }}>
              Setting up your course…
            </Text>
          )}
        </View>
      </Ui2Screen>
    );
  }

  /**
   * The trial lesson runs OUTSIDE the form chrome: full-bleed, with the
   * runner's own progress bar and no onboarding step header. Two progress
   * indicators on one screen measure different things and read as a bug.
   *
   * `userId` is deliberately empty. Every persistence path in LessonRunner —
   * the resume snapshot, the SRS warm-up, review-item writes — is guarded on
   * it, so the run touches neither the network nor storage. Nothing here is
   * lost by not being saved: the result the learner cares about is the score,
   * and that rides into the account on the pending draft.
   *
   * The runner still renders on the Dark Glow surface: the lesson runner is a
   * later screen in the redesign, and restyling it here would be half a job.
   */
  if (step === 'lesson') {
    return (
      <GradientBackground variant="raised">
        <SafeAreaView className="flex-1">
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <LessonRunner
              exercises={trialExercises}
              lessonId={TRIAL_LESSON_ID}
              lessonTitle={`${languageName} · Lesson 1`}
              xpReward={TRIAL_LESSON_XP}
              userId=""
              targetLanguage={targetLanguage}
              onComplete={handleTrialComplete}
              onExit={() => setStep('building')}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  /**
   * The payoff loader. Nothing is fetched here — the level is the learner's own
   * answer and the first lesson is bundled — but the result lands better as
   * something built than something echoed back. ~2.4s, then the save ask.
   */
  if (step === 'building') {
    return (
      <Ui2Screen fixed>
        <PlanBuilder
          stages={[`Setting your level · ${band}`, 'Picking your first lesson', "Preparing today's read"]}
          onDone={() => setStep('save')}
        />
      </Ui2Screen>
    );
  }

  /**
   * Reciprocity (DESIGN.md §UX Psychology Principles #3) and the IKEA
   * effect (#4): the learner has already been taught something before an
   * email was ever asked for. The ask is to keep what they have, not to
   * unlock what they might get.
   */
  if (step === 'save') {
    return (
      <Ui2Screen
        footer={
          <>
            <SlabButton
              label={user ? 'Start learning' : 'Save my progress'}
              onPress={handleFinish}
              loading={saving}
              disabled={saving}
              arrow={false}
            />
            <SlabButton
              label="Change my setup"
              variant="ghost"
              onPress={() => {
                haptic('buttonPress');
                setStep('goal');
              }}
              accessibilityHint="Go back and change your answers"
            />
          </>
        }
      >
        <Animated.View entering={shouldReduce ? undefined : FadeInDown.duration(360)} style={styles.centerCol}>
          <MascotSol size={110} mood="cheer" />
          <Text accessibilityRole="header" style={{ fontFamily: type.heading, fontSize: 30, lineHeight: 34, color: c.ink }}>
            {trial ? 'Nice work.' : 'Ready when you are.'}
          </Text>
          <Text style={{ fontFamily: type.ui, fontSize: 14, lineHeight: 20, color: c.muted, textAlign: 'center' }}>
            {trial
              ? `That was your first ${languageName} lesson. Create an account to keep it — otherwise it disappears when you close the app.`
              : `Create an account to save your ${languageName} setup and pick up where you left off.`}
          </Text>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <SlabCard tint="primary" style={styles.levelCard} accessibilityLabel={`Your level: ${band}. ${cefrCanDo(band)}`}>
            <View style={[styles.levelBadge, { backgroundColor: c.primary }]}>
              <Text style={{ fontFamily: type.heading, fontSize: 22, color: c.onPrimary }}>{band}</Text>
            </View>
            <View style={styles.levelText}>
              <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.onTint }]}>Your level</Text>
              <Text style={{ fontFamily: type.uiBold, fontSize: 14, lineHeight: 19, color: c.ink }}>{cefrCanDo(band)}</Text>
            </View>
          </SlabCard>
        </Animated.View>

        {trial && (
          <Animated.View entering={enter(2)} style={styles.statRow}>
            <SlabCard tint="green" style={styles.stat}>
              <Text style={{ fontFamily: type.heading, fontSize: 26, lineHeight: 30, color: c.ink }}>
                {trial.correctCount} / {trial.totalCount}
              </Text>
              <Text style={{ fontFamily: type.uiBold, fontSize: 12, color: c.muted }}>correct</Text>
            </SlabCard>
            <SlabCard tint="yellow" style={styles.stat}>
              <Text style={{ fontFamily: type.heading, fontSize: 26, lineHeight: 30, color: c.ink }}>1</Text>
              <Text style={{ fontFamily: type.uiBold, fontSize: 12, color: c.muted }}>lesson done</Text>
            </SlabCard>
          </Animated.View>
        )}

        <Animated.View entering={enter(3)}>
          <SlabCard style={{ gap: 6 }}>
            <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.green }]}>Signing up saves</Text>
            <Text style={{ fontFamily: type.uiBold, fontSize: 14, lineHeight: 20, color: c.ink }}>
              {trial ? 'This lesson · your' : 'Your'} {languageName} course and level · your progress, from today
            </Text>
          </SlabCard>
        </Animated.View>
      </Ui2Screen>
    );
  }

  // ─── The five form steps ────────────────────────────────────────────────
  const prev: Partial<Record<Step, Step>> = {
    idealSelf: 'language',
    level: 'idealSelf',
    identity: 'level',
    goal: 'identity',
  };
  const goBack = prev[step] ? () => setStep(prev[step] as Step) : undefined;

  let footer: React.ReactNode = null;
  let body: React.ReactNode = null;

  if (step === 'language') {
    footer = <SlabButton label={`Continue with ${languageName}`} onPress={() => setStep('idealSelf')} />;
    body = (
      <>
        <SpeechBubble text="What language do you want to learn?" mood={mood} />
        <View style={styles.rows}>
          {SUPPORTED_LANGUAGES.map((lang, i) => (
            <OptionRow
              key={lang.code}
              index={i}
              title={lang.name}
              selected={targetLanguage === lang.code}
              onSelect={() => {
                setTargetLanguage(lang.code as LanguageCode);
                cheer();
              }}
              lead={<FlagTile flag={lang.flag} />}
            />
          ))}
        </View>
      </>
    );
  }

  if (step === 'idealSelf') {
    const hasText = idealL2Self.trim().length > 0;
    footer = (
      <SlabButton label={hasText ? 'Continue' : 'Skip for now'} arrow={hasText} onPress={() => setStep('level')} />
    );
    body = (
      <>
        <SpeechBubble text={`Picture a moment you'd love to have in ${languageName}.`} mood="think" />
        <Animated.View entering={enter(0)}>
          <Text style={{ fontFamily: type.ui, fontSize: 14, lineHeight: 20, color: c.muted }}>
            One sentence is enough. You can skip this if you&apos;d rather not say.
          </Text>
        </Animated.View>
        <Animated.View entering={enter(1)}>
          <SlabCard style={[styles.inputCard, { borderColor: c.primary }]}>
            <TextInput
              value={idealL2Self}
              onChangeText={(text) => setIdealL2Self(text.slice(0, IDEAL_SELF_MAX_CHARS))}
              placeholder={IDEAL_SELF_PLACEHOLDER[targetLanguage] ?? IDEAL_SELF_PLACEHOLDER.en}
              placeholderTextColor={c.idle}
              multiline
              numberOfLines={4}
              maxLength={IDEAL_SELF_MAX_CHARS}
              style={[styles.multiline, { fontFamily: type.ui, color: c.ink }]}
              accessibilityLabel="Your ideal L2 self — a sentence describing your language vision"
            />
            <Text style={{ fontFamily: type.uiHeavy, fontSize: 12, color: c.muted, textAlign: 'right' }}>
              {idealL2Self.length} / {IDEAL_SELF_MAX_CHARS}
            </Text>
          </SlabCard>
        </Animated.View>
        <Animated.View entering={enter(2)} style={styles.chips}>
          {IDEAL_SELF_STARTERS.map((s) => (
            <Chip key={s.tag} label={s.tag} onPress={() => setIdealL2Self(s.text(languageName))} />
          ))}
        </Animated.View>
      </>
    );
  }

  if (step === 'level') {
    footer = <SlabButton label="Continue" onPress={() => setStep('identity')} />;
    body = (
      <>
        <SpeechBubble text="What's your level?" mood={mood} />
        {/* The acronym used to be introduced on the removed mode step, and
            this is now the first and only place a new user meets it — so it
            defines itself here or nowhere. */}
        <Animated.View entering={enter(0)}>
          <Text style={{ fontFamily: type.ui, fontSize: 14, lineHeight: 20, color: c.muted }}>
            Pick whichever is closest. Nothing here is a test, and you can change it any time. From
            here on your progress is shown as a CEFR level — the A1 to C2 scale — stated as what you
            can actually do.
          </Text>
        </Animated.View>
        <View style={styles.rows}>
          {LEVELS.map((l, i) => (
            <OptionRow
              key={l.value}
              index={i + 1}
              title={l.label}
              subtitle={l.description}
              selected={level === l.value}
              onSelect={() => {
                setLevel(l.value);
                cheer();
              }}
              lead={<LevelBars lit={LEVEL_BARS[l.value]} />}
              trail={<Chip label={cefrBandForProficiencyLevel(l.value)} />}
            />
          ))}
        </View>
      </>
    );
  }

  /*
    IKEA effect (DESIGN.md §UX Psychology Principles #4): the learner builds
    something of their own before the sign-up gate, so leaving means
    abandoning it rather than skipping a form.
  */
  if (step === 'identity') {
    footer = <SlabButton label="Continue" onPress={() => setStep('goal')} />;
    body = (
      <>
        <SpeechBubble text="Make it yours" mood={mood} />
        <Animated.View entering={enter(0)}>
          <Text style={{ fontFamily: type.ui, fontSize: 14, lineHeight: 20, color: c.muted }}>
            Pick a name and a look. This is who you&apos;ll be in {languageName}.
          </Text>
        </Animated.View>
        <Animated.View entering={enter(1)}>
          <SlabCard style={[styles.inputCard, { borderColor: c.primary }]}>
            <TextInput
              value={displayName}
              onChangeText={(text) => setDisplayName(text.slice(0, DISPLAY_NAME_MAX_CHARS))}
              placeholder="What should we call you?"
              placeholderTextColor={c.idle}
              maxLength={DISPLAY_NAME_MAX_CHARS}
              style={[styles.singleLine, { fontFamily: type.uiHeavy, color: c.ink }]}
              accessibilityLabel="Your display name"
              autoFocus={!displayName}
            />
          </SlabCard>
        </Animated.View>
        <Animated.View entering={enter(2)}>
          <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.muted }]}>Pick a look</Text>
        </Animated.View>
        <Animated.View entering={enter(3)}>
          <SlabCard style={styles.avatarRow}>
            <Avatar
              size="medium"
              imageUri={avatarPresetId ? presetUrlFromId(avatarPresetId) : null}
              displayName={displayName}
            />
            <View style={{ flex: 1 }}>
              <SlabButton
                label={avatarPresetId ? 'Change avatar' : 'Choose avatar'}
                variant="onPrimary"
                arrow={false}
                onPress={() => setCustomizerOpen(true)}
              />
            </View>
          </SlabCard>
        </Animated.View>

        {/* Pre-auth, deliberately. The preset catalogue is anon-readable
            (migration 082) precisely so this step keeps its avatar — the
            IKEA effect above depends on the learner building something
            before the sign-up gate, not after it. The choice rides in the
            local draft and is flushed by writeProfile once a session
            exists; nothing is written server-side here. */}
        <AvatarPresetPicker
          visible={customizerOpen}
          selectedId={avatarPresetId}
          onClose={() => setCustomizerOpen(false)}
          onSelect={(preset: AvatarPreset) => {
            setAvatarPresetId(preset.id);
            setCustomizerOpen(false);
            cheer();
          }}
        />
      </>
    );
  }

  if (step === 'goal') {
    // No bundled trial for this language yet — skip to the loader rather
    // than teach the wrong one (components/onboarding/trial-lesson.ts).
    footer = (
      <SlabButton
        label={trialAvailable ? 'Start my first lesson' : 'Continue'}
        onPress={() => setStep(trialAvailable ? 'lesson' : 'building')}
      />
    );
    body = (
      <>
        <SpeechBubble text="How much time do you have?" mood={mood} />
        <Animated.View entering={enter(0)}>
          <Text style={{ fontFamily: type.ui, fontSize: 14, lineHeight: 20, color: c.muted }}>
            This sets the length of your daily session. Nothing breaks if you skip a day.
          </Text>
        </Animated.View>
        <View style={styles.rows}>
          {/* No commitment labels. The scale used to end at "Insane", which
              dares the learner into a budget they will miss, and a missed
              daily goal is the first step out of the habit. */}
          {DAILY_GOALS.map((goal, i) => (
            <OptionRow
              key={goal}
              index={i + 1}
              title={`${goal} minutes`}
              subtitle={goal <= 5 ? 'One quick exercise' : goal <= 10 ? 'A short session' : goal <= 15 ? 'A full session' : 'Session plus a read'}
              selected={dailyGoal === goal}
              onSelect={() => {
                setDailyGoal(goal);
                cheer();
              }}
              lead={<Chip label={`${goal}`} />}
              accessibilityLabel={`${goal} minutes per day`}
            />
          ))}
        </View>
      </>
    );
  }

  return (
    <Ui2Screen footer={footer}>
      {/* Step indicator — always shows real, non-zero progress (goal gradient,
          DESIGN.md §UX Psychology Principles #2). */}
      <StepHeader step={stepIndex + 1} total={ALL_STEPS.length} onBack={goBack} />
      {/* Keyed on the step so the body remounts and every entering animation
          replays: the slide-in bubble, the row cascade. */}
      <View key={step} style={styles.stepBody}>
        {body}
      </View>
    </Ui2Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerCol: { alignItems: 'center', gap: 12, paddingTop: 8 },
  stepBody: { gap: 18 },
  rows: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inputCard: { gap: 10 },
  multiline: { fontSize: 16, lineHeight: 24, minHeight: 110, textAlignVertical: 'top', padding: 0 },
  singleLine: { fontSize: 16, lineHeight: 22, padding: 0, minHeight: 28 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  eyebrow: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  levelCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  levelBadge: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  levelText: { flex: 1, gap: 3 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 2, padding: 14 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 22 },
  bar: { width: 5, borderRadius: 2 },
  flagTile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flagGlyph: { fontSize: 20 },
});
