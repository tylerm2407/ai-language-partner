import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../stores/useAppStore';
import { Ui2Screen } from '../../components/ui2/Ui2Screen';
import { SlabButton } from '../../components/ui2/SlabButton';
import { StepHero, type StepHeroEntrance } from '../../components/ui2/StepHero';
import type { MascotMood } from '../../components/ui2/MascotSol';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { useMotion } from '../../hooks/useMotion';
import { cefrBandForProficiencyLevel } from '../../lib/cefr-proficiency';
import { trialExercisesFor } from '../../components/onboarding/trial-lesson';
import { hasTopicPack, topicPackFor } from '../../components/onboarding/topic-packs';
import { FALLBACK_TRIAL_TOPIC, resolveTrialTopic } from '../../components/onboarding/trial-topic';
import { PlanReveal } from '../../components/onboarding/PlanReveal';
import { haptic } from '../../lib/haptics';
import { SUPPORTED_LANGUAGES } from '../../config/app';
import { authErrorCopy } from '../../lib/auth-errors';
import { trackEvent } from '../../lib/analytics';
import { useScreenView } from '../../hooks/useScreenView';
import { savePendingOnboarding, type PendingOnboardingDraft } from '../../lib/pending-onboarding';
import { flushDraftToProfile } from '../../components/onboarding/flush-draft';
import { useOnboardingAnswers } from '../../components/onboarding/useOnboardingAnswers';
import { useDraftBootstrap } from '../../components/onboarding/useDraftBootstrap';
import { TrialLessonStep } from '../../components/onboarding/steps/TrialLessonStep';
import { useMascotMood, type StepFrame } from '../../components/onboarding/steps/bits';
import { ALL_STEPS, FUNNEL_STEPS, type Step } from '../../components/onboarding/steps/config';
import {
  CourseStep,
  GoalStep,
  LanguageStep,
  LevelStep,
  NotificationsStep,
} from '../../components/onboarding/steps/FormSteps';
import { IdealSelfStep } from '../../components/onboarding/steps/IdealSelfStep';
import { SaveStep } from '../../components/onboarding/steps/SaveStep';

/**
 * The onboarding flow. Ten steps, the first seven a form, then the bundled
 * micro lesson, the plan reveal and the sign-up ask. Every answer lives in a
 * local draft until a session exists; `flushDraftToProfile` then writes it
 * server-side in one call. The step components live in
 * `components/onboarding/steps/`; this file owns the state, the draft, the
 * flush and the routing between steps.
 */
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

  const [step, setStep] = useState<Step>('language');
  const [saving, setSaving] = useState(false);

  // Every answer, the draft built from them, and the restore function. Kept
  // in one hook so a saved field is always a restored field.
  const {
    startedAt,
    setCompletedAt,
    targetLanguage,
    setTargetLanguage,
    idealL2Self,
    setIdealL2Self,
    topic,
    setTopic,
    level,
    setLevel,
    courseChoice,
    setCourseChoice,
    placementOptions,
    notificationPrefs,
    setNotificationPrefs,
    trial,
    recordTrial,
    dailyGoal,
    setDailyGoal,
    draft,
    applyPending,
  } = useOnboardingAnswers();
  const hasCourseStep = placementOptions.length > 0;

  const languageName =
    SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage)?.name ?? 'your language';

  /**
   * Write the collected answers into the real profile, then leave. Shared by
   * the post-signup flush and by the already-authenticated path (an existing
   * account whose onboarding never finished).
   *
   * ONE navigation, not two. This used to be `replace('/(app)')` followed
   * immediately by `push('/avatar-setup')`, which is two dispatches in the
   * same tick where the first one remounts the whole (app) layout — the push
   * could land on a navigator that was still mounting and be dropped, sending
   * the learner straight to Home and skipping the avatar entirely. The whole
   * chain is replaces — avatar-setup replaces into plans, plans replaces into
   * Home — which is also what keeps a finished setup step off the back stack.
   *
   * What follows the flush is name + avatar (`app/(app)/identity-setup.tsx`,
   * where the photo avatar can actually render now that a session exists),
   * then the paywall, then Home.
   */
  const writeProfile = useCallback(
    async (userId: string, draft: PendingOnboardingDraft) => {
      await flushDraftToProfile(draft);
      await loadUserData(userId);
      router.replace('/(app)/identity-setup');
    },
    [loadUserData, router],
  );

  // Mount: read the local draft. If the learner has just signed up and the
  // draft is complete, this screen's only job is to flush it and get out.
  // `hydrated` gates the first render until the draft has been read, so a
  // resumed flow never flashes the defaults first; `flushing` covers the
  // post-signup path. A failed flush lands on the save step with the answers
  // restored, where the button retries the same idempotent RPC.
  const onFlushFailed = useCallback(() => setStep('save'), []);
  const { hydrated, flushing } = useDraftBootstrap({
    authLoading,
    userId: user?.id ?? null,
    writeProfile,
    applyPending,
    onFlushFailed,
  });

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
        // Fired on the successful write rather than on the tap: the funnel's
        // last step must mean "the profile was written", not "they pressed
        // the button". Counting taps here would hide exactly the failures
        // worth knowing about.
        haptic('complete');
        trackEvent('onboarding_completed', {
          language: targetLanguage,
          band: level,
          count: Math.round((Date.now() - (startedAt ?? Date.now())) / 1000),
          source: 'authenticated',
          outcome: 'profile_persisted',
          ...(topic ? { topic } : {}),
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
      // This is durable only on the device. The authoritative completion fires
      // after writeProfile succeeds on the post-signup flush, making the loss
      // between draft, account creation, and server persistence measurable.
      trackEvent('onboarding_draft_saved', {
        language: targetLanguage,
        band: level,
        count: Math.round((Date.now() - (startedAt ?? Date.now())) / 1000),
        outcome: 'local_persisted',
        ...(topic ? { topic } : {}),
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
   * The pack behind everything downstream of the ideal-self step: the trial's
   * exercises, the plan the reveal lays out, the sentence the save screen puts
   * in the headline. Memoised because `topicPackFor` builds a fresh array on
   * every call, and a new identity hands LessonRunner a "new" lesson mid-run,
   * re-firing its prefetch and restore effects.
   */
  const pack = useMemo(
    () => topicPackFor(targetLanguage, topic ?? FALLBACK_TRIAL_TOPIC),
    [targetLanguage, topic],
  );

  /**
   * The trial exercises. The pack is the point — a learner who said "moving
   * abroad" gets the moving-abroad micro lesson — and `trialExercisesFor` is
   * the floor beneath it for a language that has no packs at all. An empty
   * array means neither exists, and the flow skips the lesson entirely rather
   * than teaching the wrong one.
   */
  const trialExercises = useMemo(
    () => pack?.exercises ?? trialExercisesFor(targetLanguage),
    [pack, targetLanguage],
  );
  const trialAvailable = trialExercises.length > 0;

  // One effect rather than instrumenting a dozen setStep call sites: this
  // records every ARRIVAL at a step however it happened, including going back,
  // and cannot drift out of step with a button somebody adds later.
  //
  // Gated on `hydrated` because the draft is read asynchronously — firing
  // before it lands would report 'language' for a learner who is actually
  // resuming at step four, and quietly invent a drop-off that never happened.
  useEffect(() => {
    if (!hydrated) return;
    trackEvent('onboarding_step_viewed', {
      stepName: step,
      step: FUNNEL_STEPS.indexOf(step) + 1,
      count: FUNNEL_STEPS.length,
      language: targetLanguage,
      // Omitted rather than defaulted while it is null. `travel` is what the
      // LESSON falls back to, and sending it as the topic would report a guess
      // as a choice — the one number this property exists to measure.
      ...(topic ? { topic } : {}),
    });
  }, [step, hydrated, targetLanguage, topic]);

  const stepIndex = ALL_STEPS.indexOf(step);
  const band = cefrBandForProficiencyLevel(level);
  const idealText = idealL2Self.trim() ? idealL2Self.trim() : null;

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

  // The micro lesson, full-bleed and outside the form chrome. The result is
  // recorded into the draft; nothing is written server-side yet.
  if (step === 'lesson') {
    return (
      <TrialLessonStep
        exercises={trialExercises}
        languageName={languageName}
        targetLanguage={targetLanguage}
        onComplete={recordTrial}
        onExit={() => setStep('planReveal')}
      />
    );
  }

  // The payoff. What the loader used to mime, shown for real: the learner's
  // own sentence, the words they now have, and the six lessons that follow.
  if (step === 'planReveal') {
    return (
      <PlanReveal
        languageName={languageName}
        pack={pack}
        idealText={idealText}
        band={band}
        dailyGoalMinutes={dailyGoal}
        trialCompleted={!!trial}
        onSave={() => setStep('save')}
        onChangeSetup={() => setStep('goal')}
      />
    );
  }

  const enter: StepFrame['enter'] = (i) =>
    shouldReduce ? undefined : FadeInDown.delay(80 + i * 40).duration(360);

  if (step === 'save') {
    return (
      <SaveStep
        frame={{ enter }}
        signedIn={!!user}
        reduceMotion={shouldReduce}
        pack={pack}
        trialCompleted={!!trial}
        idealText={idealText}
        languageName={languageName}
        band={band}
        placementOptions={placementOptions}
        courseChoice={courseChoice}
        dailyGoal={dailyGoal}
        notificationPrefs={notificationPrefs}
        saving={saving}
        onFinish={handleFinish}
        onChangeSetup={() => setStep('goal')}
      />
    );
  }

  // ─── The six form steps ─────────────────────────────────────────────────
  const prev: Partial<Record<Step, Step>> = {
    idealSelf: 'language',
    level: 'idealSelf',
    course: 'level',
    goal: hasCourseStep ? 'course' : 'level',
    notifications: 'goal',
  };
  // The first step backs out to the welcome screen: someone who already has
  // an account and tapped "Get started" by mistake needs a way to "I already
  // have an account" without killing the app. Welcome pushes this route, so
  // back() normally lands there; the replace covers a cold start straight
  // into onboarding (deep link, resumed draft) where there is no history.
  const leaveToWelcome = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(public)');
  };
  const goBack = prev[step] ? () => setStep(prev[step] as Step) : leaveToWelcome;
  // The step's header block: back, "Step n of 6", segments, the question, Sol.
  const hero = (text: string, entrance: StepHeroEntrance, heroMood: MascotMood = mood) => (
    <StepHero
      step={stepIndex + 1}
      total={ALL_STEPS.length}
      text={text}
      onBack={goBack}
      mood={heroMood}
      entrance={entrance}
    />
  );
  const frame: StepFrame = { hero, enter, cheer };

  // The chips no longer just fill the box — each one names a topic, and the
  // topic picks the micro lesson two steps later. A learner who types instead
  // of tapping still gets one, guessed from their words on the way out of the
  // step; a guess that fails leaves `topic` null, which is honest.
  const commitTopic = () => setTopic((current) => resolveTrialTopic(idealL2Self, current));

  let footer: React.ReactNode = null;
  let body: React.ReactNode = null;

  switch (step) {
    case 'language':
      footer = <SlabButton label={`Continue with ${languageName}`} onPress={() => setStep('idealSelf')} />;
      body = <LanguageStep frame={frame} value={targetLanguage} onChange={setTargetLanguage} />;
      break;
    case 'idealSelf':
      footer = (
        <SlabButton
          label={idealText ? 'Continue' : 'Skip for now'}
          arrow={!!idealText}
          onPress={() => {
            commitTopic();
            setStep('level');
          }}
        />
      );
      body = (
        <IdealSelfStep
          frame={frame}
          targetLanguage={targetLanguage}
          languageName={languageName}
          text={idealL2Self}
          onChangeText={setIdealL2Self}
          topic={topic}
          onPickChip={(key, sentence) => {
            setTopic(key);
            setIdealL2Self(sentence);
          }}
          onCommitTopic={commitTopic}
          solLine={topic && hasTopicPack(targetLanguage, topic) ? pack?.solLine : null}
        />
      );
      break;
    case 'level':
      footer = (
        <SlabButton label="Continue" onPress={() => setStep(hasCourseStep ? 'course' : 'goal')} />
      );
      body = <LevelStep frame={frame} value={level} onChange={setLevel} />;
      break;
    case 'course':
      footer = <SlabButton label="Continue" onPress={() => setStep('goal')} />;
      body = (
        <CourseStep frame={frame} options={placementOptions} value={courseChoice} onChange={setCourseChoice} />
      );
      break;
    case 'goal':
      footer = <SlabButton label="Continue" onPress={() => setStep('notifications')} />;
      body = <GoalStep frame={frame} value={dailyGoal} onChange={setDailyGoal} />;
      break;
    case 'notifications':
      // The last form step, and the one that hands off to the lesson. A
      // language with no pack and no bundled fallback skips straight to the
      // plan rather than teaching the wrong words (components/onboarding/topic-packs).
      footer = (
        <SlabButton
          label={trialAvailable ? 'Start my first lesson' : 'Continue'}
          onPress={() => setStep(trialAvailable ? 'lesson' : 'planReveal')}
        />
      );
      body = (
        <NotificationsStep
          frame={frame}
          prefs={notificationPrefs}
          onChange={setNotificationPrefs}
          dailyGoalMinutes={dailyGoal}
        />
      );
      break;
  }

  return (
    <Ui2Screen footer={footer}>
      {/* Keyed on the step so the body remounts and every entering animation
          replays: the hero block's entrance, the segments, the row cascade.
          The step indicator lives inside the hero and always shows real,
          non-zero progress (goal gradient, DESIGN.md §UX Psychology
          Principles #2). */}
      <View key={step} style={styles.stepBody}>
        {body}
      </View>
    </Ui2Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stepBody: { gap: 18 },
});
