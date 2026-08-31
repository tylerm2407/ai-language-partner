import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchLessonWithExercises } from '../../../lib/supabase-queries';
import { cachedFetch, readCacheKey } from '../../../lib/read-cache';
import { orderExercisesForCognitiveLoad, lessonIsAlreadyOrdered } from '../../../lib/lesson-ordering';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/useAppStore';
import { useProfile } from '../../../hooks/useProfile';
import { useDailyStats } from '../../../hooks/useDailyStats';
import { useLevel } from '../../../hooks/useLevel';
import { useLessonProgress } from '../../../hooks/useLessonProgress';
import { useOnboardingChecklist } from '../../../hooks/useOnboardingChecklist';
import { LessonRunner, type LessonResult } from '../../../components/lesson/LessonRunner';
import { AchievementModal } from '../../../components/gamification/AchievementModal';
import { checkAndAwardAchievements, type AchievementDefinition } from '../../../lib/achievements';
import { lessonXpKey } from '../../../lib/offline-queue';
import { getTargetLanguage } from '../../../lib/language';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { Button } from '../../../components/ui/Button';
import { Body } from '../../../components/ui/Text';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { colors, spacing } from '../../../config/theme';
import type { Lesson } from '../../../types';

export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const router = useRouter();
  const goBack = useSafeBack('/(app)');
  const { user } = useAuth();
  const { profile } = useAppStore();
  const { earnXp } = useProfile();
  const { addStats } = useDailyStats();
  const { dismissLevelUp } = useLevel();
  const { markLessonComplete } = useLessonProgress();
  const { markItem: markOnboardingItem } = useOnboardingChecklist();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, setAchievementQueue] = useState<AchievementDefinition[]>([]);
  // How the finished lesson was recorded — drives the sync notice below.
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'queued' | 'failed'>('idle');
  const [showingAchievement, setShowingAchievement] = useState<AchievementDefinition | null>(null);

  const loadLesson = useCallback(() => {
    if (!lessonId) return;
    setLoading(true);
    setLoadError(null);
    // Stale-while-revalidate: a recently-opened lesson renders from cache
    // (playable offline) while the fetch revalidates silently. The error
    // screen only shows when the fetch fails AND nothing is cached.
    cachedFetch<Lesson | null>(
      readCacheKey('lesson', lessonId),
      () => fetchLessonWithExercises(lessonId),
      { onCached: (cached) => { setLesson(cached); setLoading(false); } },
    ).then(({ data }) => {
      setLesson(data);
      setLoading(false);
    }).catch((err) => {
      setLoadError(err instanceof Error ? err.message : 'Failed to load lesson');
      setLoading(false);
    });
  }, [lessonId]);

  useEffect(() => {
    loadLesson();
  }, [loadLesson]);

  const targetLanguage = getTargetLanguage(profile);

  /**
   * Ordered once per lesson, not once per render.
   *
   * This ternary used to sit inline in the JSX, and
   * `orderExercisesForCognitiveLoad` returns a NEW array every call — so
   * `LessonRunner` received a fresh `exercises` identity on every render. That
   * array is a dependency of three effects inside the runner (SRS prefetch,
   * session restore, audio prewarm); today they survive only because each
   * carries its own module-scoped ref guard. That is a load-bearing accident:
   * relax any one of those guards and the restore effect resets `currentIndex`
   * mid-lesson.
   *
   * Declared above the early returns below — hooks cannot be conditional.
   */
  const orderedExercises = useMemo(() => {
    if (!lesson) return [];
    return lessonIsAlreadyOrdered(lesson.exercises)
      ? lesson.exercises
      : orderExercisesForCognitiveLoad(lesson.exercises);
  }, [lesson]);

  // Also wait for the profile: grading needs the real target language, so
  // never fall back to a default while it loads.
  //
  // The paywall used to fire from here, on the first completed lesson. It
  // does not any more: the first lesson happens before the account exists
  // (app/(public)/onboarding.tsx) and the ask lands right after sign-up and
  // the free avatar. Finishing a lesson in the app is now just finishing a
  // lesson — no sales pitch attached to the celebration.

  if (loading || !targetLanguage) {
    return (
      <GradientBackground variant="raised">
      <SafeAreaView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.league.diamond} />
      </SafeAreaView>
      </GradientBackground>
    );
  }

  // Network/server failure — distinct from "lesson doesn't exist" so the
  // user knows a retry can help.
  if (loadError) {
    return (
      <GradientBackground variant="raised">
      <SafeAreaView className="flex-1 items-center justify-center px-8">
        <Body size="lg" tone="secondary" style={{ marginBottom: 16, textAlign: 'center' }}>
          Couldn't load this lesson. Check your connection and try again.
        </Body>
        <Button label="Try Again" variant="primary" onPress={loadLesson} />
        <View style={{ marginTop: 12 }}>
          <Button label="Go Back" variant="secondary" onPress={goBack} />
        </View>
      </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!lesson) {
    return (
      <GradientBackground variant="raised">
      <SafeAreaView className="flex-1 items-center justify-center px-8">
        <Body size="lg" tone="secondary" style={{ marginBottom: 16 }}>Lesson not found</Body>
        <Button label="Go Back" variant="secondary" onPress={goBack} />
      </SafeAreaView>
      </GradientBackground>
    );
  }

  /**
   * Finishing a lesson runs four independent side effects. Completion is
   * recorded FIRST and nothing is allowed to run ahead of it: `earnXp` used
   * to be awaited unguarded at the top, so any throw there (or in addStats)
   * aborted the handler and the lesson was never recorded — the learner had
   * done the work and the path had not moved. Each step now fails on its own.
   */
  const handleComplete = async (result: LessonResult) => {
    // 1. Completion — the durable record of progress. Resolves once the row
    //    is in Postgres or in the replay queue (see useLessonProgressStore).
    if (lesson && user?.id) {
      // The runner already computed this, skip-aware: a question the learner
      // could not hear is out of the denominator rather than counted wrong.
      // Recomputing it here from correctCount/totalExercises is exactly how
      // the recorded score and the score the learner was shown drifted apart.
      const score = result.accuracy;
      if (!lesson.courseId) {
        // course_id is NOT NULL; without it the row can never be written, so
        // say so instead of failing silently on a uuid parse error.
        console.error('[lesson] no course for lesson', lesson.id, '— completion not recorded');
        Sentry.captureMessage('lesson completion skipped: lesson has no course', {
          level: 'error',
          tags: { area: 'lesson-completion' },
          extra: { lessonId: lesson.id },
        });
        setSaveState('failed');
      } else {
        try {
          const { persisted } = await markLessonComplete(
            lesson.id,
            lesson.courseId,
            score,
            result.xpEarned,
            result.timeSpentMs,
          );
          setSaveState(persisted ? 'saved' : 'queued');
        } catch (err) {
          console.error('[lesson] markLessonComplete failed:', err);
          setSaveState('failed');
        }
      }
    }

    // 2. XP, keyed to the lesson so a replay never pays twice. Queued offline
    //    by earnXp itself under that same key.
    if (result.xpEarned > 0 && lesson) {
      await earnXp(result.xpEarned, lessonXpKey(lesson.id)).catch((err) =>
        console.error('[lesson] earnXp failed:', err),
      );
    }

    // 3. Daily stats — cosmetic rollup; never blocks anything above.
    // `accuracy` is set-if-provided rather than additive (see upsertDailyStats),
    // so this records the accuracy of the lesson just finished. Omitting it left
    // the column at 0 for everyone, which made `perfect_lesson` — checked as
    // `accuracy >= 1` — unreachable by any user, ever. The value was already
    // sitting in `result`.
    await addStats({
      lessonsCompleted: 1,
      xpEarned: result.xpEarned,
      accuracy: result.accuracy,
    }).catch((err) => console.error('[lesson] addStats failed:', err));

    if (lesson && user?.id) {
      // 4. Onboarding checklist + achievements.
      markOnboardingItem('firstLesson').catch(console.error);

      if (profile) {
        const { dailyStats } = useAppStore.getState();
        // `.catch(() => [])` was swallowing this entirely — not even logged —
        // so an achievement the learner earned could silently never appear and
        // nothing anywhere would say why.
        const newAchievements = await checkAndAwardAchievements(user.id, profile, dailyStats).catch(
          (err) => {
            console.error('[lesson] achievement check failed:', err);
            Sentry.captureException(err, { tags: { area: 'achievements' } });
            return [];
          },
        );
        if (newAchievements.length > 0) {
          setAchievementQueue(newAchievements);
          setShowingAchievement(newAchievements[0]);
        }
      }
    }
  };

  /**
   * Leaving the lesson — by finishing it or by quitting.
   *
   * `LessonRunner` uses one callback for both finishing and quitting, so this
   * has to be safe for a lesson abandoned halfway through as well as one that
   * was completed.
   */
  const handleExit = () => {
    // Tear down anything presented OVER this screen before navigating.
    //
    // CelebrationOverlay and AchievementModal are React Native <Modal>s, and
    // handleComplete can leave the achievement one visible at the moment
    // Continue is tapped. A Modal that is still `visible` when the screen pops
    // keeps its own presented view alive — the navigation happens, but the
    // learner sees the celebration sitting there and reads it as a dead button.
    // Closing it first is what makes the pop visible.
    setShowingAchievement(null);
    setAchievementQueue([]);
    // Nothing renders the level-up any more, but the pending record still has to
    // be cleared or useLevel replays it against the next lesson's state.
    dismissLevelUp();

    // router.back() is a silent no-op with nothing beneath. A deep link, a
    // notification tap or a cold start straight into a lesson has no parent
    // screen — and then Continue does nothing at all.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)');
    }
  };

  const dismissAchievement = () => {
    setAchievementQueue((prev) => {
      const remaining = prev.slice(1);
      setShowingAchievement(remaining[0] ?? null);
      return remaining;
    });
  };

  return (
    <GradientBackground variant="raised">
    <SafeAreaView className="flex-1">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      {/* Completion sync notice. The learner is never blocked by it — the
          completion is already in the shared progress store either way — but
          silence would be dishonest when the row is only queued. */}
      {saveState === 'queued' && (
        <View style={{ backgroundColor: colors.surface.card, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
          <Body size="sm" tone="secondary" style={{ textAlign: 'center' }}>
            Progress saved on this device — it'll sync when you're back online.
          </Body>
        </View>
      )}
      {saveState === 'failed' && (
        <View style={{ backgroundColor: colors.surface.card, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
          <Body size="sm" tone="secondary" style={{ textAlign: 'center' }}>
            We couldn't save this lesson. Please try it again.
          </Body>
        </View>
      )}

      <LessonRunner
        exercises={orderedExercises}
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        xpReward={lesson.xpReward}
        userId={user?.id ?? ''}
        targetLanguage={targetLanguage}
        onComplete={handleComplete}
        onExit={handleExit}
      />
      </KeyboardAvoidingView>

      {/* The LevelUpModal used to fire here. The numeric level it celebrated is
          no longer shown anywhere, so a full-screen modal announcing it was
          celebrating a number the learner cannot go and look at. XP still
          accrues and still drives achievements — those keep their modal. */}

      {/* Achievement Celebration */}
      <AchievementModal
        achievement={showingAchievement}
        visible={!!showingAchievement}
        onDismiss={dismissAchievement}
      />
    </SafeAreaView>
    </GradientBackground>
  );
}
