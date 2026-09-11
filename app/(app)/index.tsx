import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../stores/useAppStore';
import { useSchoolStore } from '../../stores/useSchoolStore';
import { SCHOOL_ENABLED, HANDSFREE_ENABLED, levelToNewsTier } from '../../config/app';
import { fetchStatsRange } from '../../lib/supabase-queries';
import { localDayKey } from '../../lib/dates';
import { getTargetLanguage, targetLanguageGreeting } from '../../lib/language';
import { cefrBandForProficiencyLevel } from '../../lib/cefr-proficiency';
import { useNextBandProgress } from '../../hooks/useNextBandProgress';
import { cefrCanDo } from '../../lib/cefr-labels';
import { useLevel } from '../../hooks/useLevel';
import { useDailyNews } from '../../hooks/useDailyNews';
import { useNotifications, syncScheduledNotifications, cacheWeekSummary } from '../../hooks/useNotifications';
import { useOnboardingChecklist } from '../../hooks/useOnboardingChecklist';
import { useReviewCountSync } from '../../hooks/useReviewCountSync';
import { PrePermissionSheet } from '../../components/gamification/PrePermissionSheet';
import { OnboardingChecklistFab } from '../../components/onboarding/OnboardingChecklistFab';
import { unitTilesToLessonTiles } from '../../components/magazine/LessonTile';
import { useUnitProgressTiles } from '../../hooks/useUnitProgressTiles';
import { useDailyChallenges } from '../../hooks/useDailyChallenges';
import { HomeHeader, LevelDueRow, SessionHero, ReadRow } from '../../components/ui2/home/HomeSections';
import { PatternsCard } from '../../components/ui2/home/HomeInsights';
import { useLearnerInsights } from '../../hooks/useLearnerInsights';
import { heroSubtitle } from '../../lib/insights';
import { DEFAULT_DAILY_GOAL_MINUTES } from '../../lib/active-time';
import { trackEvent } from '../../lib/analytics';
import { UnitRows, DailyThree, WeekStrip, ActionRow, SectionTitle } from '../../components/ui2/home/HomeProgress';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { loadErrorCopy, type ErrorCopy } from '../../lib/error-copy';
import type { DailyStats } from '../../types';

import { useScreenView } from '../../hooks/useScreenView';

/** Reading time at a learner's pace (~140 wpm in a second language). */
function readMinutes(content: string | null | undefined): number | null {
  if (!content) return null;
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 140));
}

export default function HomeScreen() {
  useScreenView('home');
  const { user } = useAuth();
  const router = useRouter();
  const { profile, dailyStats, reviewCount } = useAppStore();
  // Same reason as the learn page: the "N cards due" quick action is store
  // state that other screens change behind Home's back.
  useReviewCountSync();
  // Keep user_profiles.timezone tracking the device — the server derives
  // challenge/quota days from it (migration 044). One-shot per session.
  const [weeklyStats, setWeeklyStats] = useState<DailyStats[]>([]);
  const [weeklyStatsError, setWeeklyStatsError] = useState<ErrorCopy | null>(null);
  useLevel(); // level-up detection mirrors xpLevel/leagueTier into the store
  const { loadStudentSchoolData } = useSchoolStore();
  const schoolEnabled = SCHOOL_ENABLED;
  const newsTier = levelToNewsTier(profile?.level ?? 'intermediate');
  const { article, isLoading: newsLoading, error: newsError, hasRead: newsHasRead } = useDailyNews(
    user?.id ?? '',
    // '' = profile not loaded yet; the hook skips fetching until the real
    // target language is known instead of defaulting to a language.
    getTargetLanguage(profile) ?? '',
    newsTier,
  );
  const { permissionStatus, requestPermissionsExplicit } = useNotifications();
  const { tiles: unitTiles, loading: tilesLoading, error: tilesError, refetch: refetchTiles } = useUnitProgressTiles(
    user?.id,
    profile?.targetLanguage,
    4,
  );
  const lessonTiles = unitTiles ? unitTilesToLessonTiles(unitTiles) : null;

  // "Continue learning" is a server-side rollup, so finishing a lesson on the
  // lesson screen cannot update it in place. Re-read it whenever Home regains
  // focus — otherwise the tiles keep pointing at the lesson just completed.
  useFocusEffect(
    useCallback(() => {
      refetchTiles();
    }, [refetchTiles]),
  );
  const { markItem: markChecklistItem, skipItem: skipChecklistItem } = useOnboardingChecklist();
  const greeting = targetLanguageGreeting(getTargetLanguage(profile));
  const [showPrePermission, setShowPrePermission] = useState(false);
  const { c, scheme } = useUi2Theme();
  const { challenges } = useDailyChallenges();
  // The level card shows the MEASURED band once the proficiency report can
  // assess one; the profile's self-declared level only stands in before that.
  // Both it and the ring toward the next band are rebuilt on focus.
  const level = useNextBandProgress(cefrBandForProficiencyLevel(profile?.level ?? 'beginner'));
  const band = level.band;
  // What the tutor already knows about this learner — recurring mistakes and
  // words the SRS says keep failing. Same rows the paid tutor prompt reads.
  const insights = useLearnerInsights(user?.id, getTargetLanguage(profile));
  // The session hero points at the first unit with an unfinished lesson; the
  // rollup is ordered by curriculum position, so that is the learner's next.
  const nextTile = lessonTiles?.find((t) => t.nextLessonId) ?? null;

  // Show the pre-permission sheet once, after the learner has completed
  // their first lesson. Only asks if the OS permission is still undetermined;
  // if the user has already granted or denied at the OS level, just mark
  // the checklist item so we don't re-nag.
  useEffect(() => {
    if (showPrePermission) return;
    if (!profile?.onboardingChecklist) return;
    if (permissionStatus === null) return;
    const { firstLesson, dailyReminder } = profile.onboardingChecklist;
    if (!firstLesson || dailyReminder) return;
    if (permissionStatus === 'undetermined') {
      setShowPrePermission(true);
    } else if (permissionStatus === 'granted') {
      markChecklistItem('dailyReminder').catch(() => {});
    } else {
      // Denied at the OS level. Ticking it here used to be how we stopped
      // re-nagging, but that made the checklist claim a reminder the learner
      // will never get. Skipping resolves the step just as well and is true.
      skipChecklistItem('dailyReminder').catch(() => {});
    }
  }, [profile?.onboardingChecklist, permissionStatus, showPrePermission, markChecklistItem, skipChecklistItem]);

  const handleEnableReminders = async () => {
    // Captured outside the try so the `finally` can resolve the checklist
    // without asking the OS a second time. It stays null if the request itself
    // threw, which the skip branch below treats as "not granted".
    let status: string | null = null;
    try {
      status = await requestPermissionsExplicit();
      if (status === 'granted' && profile) {
        // The root layout re-arms on every foreground, but not in response to
        // THIS grant — its own `permissionGranted` is a different hook instance
        // and is only read on mount. So arm them here too, from the prefs the
        // learner (or onboarding) chose.
        await syncScheduledNotifications({
          minutesToday: dailyStats?.minutesPracticed ?? 0,
          goalMinutes: profile.dailyGoalMinutes ?? DEFAULT_DAILY_GOAL_MINUTES,
          dueCount: reviewCount,
          idealL2Self: profile.idealL2Self ?? null,
          topMistakeLabel: insights.mistakes[0]?.label ?? null,
          band,
        });
      }
    } finally {
      // Either way the step is resolved, but which way matters: granted is
      // done, anything else is skipped, so the row reads honestly rather than
      // claiming a reminder the learner will never receive.
      await (status === 'granted'
        ? markChecklistItem('dailyReminder')
        : skipChecklistItem('dailyReminder')
      ).catch(() => {});
      setShowPrePermission(false);
    }
  };

  const handleDismissPrePermission = async () => {
    // The learner declined our own pre-permission sheet, so the OS was never
    // asked. That is a skip, not a completion.
    await skipChecklistItem('dailyReminder').catch(() => {});
    setShowPrePermission(false);
  };

  const loadWeeklyStats = useCallback(async (userId: string) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    const startDate = localDayKey(monday);
    const endDate = localDayKey(today);
    setWeeklyStatsError(null);
    try {
      const stats = await fetchStatsRange(userId, startDate, endDate);
      setWeeklyStats(stats);
      // Publish the totals for the reminder scheduler in the root layout, which
      // words the weekly notifications and must not run this query itself.
      cacheWeekSummary({
        minutes: stats.reduce((n, s) => n + s.minutesPracticed, 0),
        words: stats.reduce((n, s) => n + s.cardsLearned, 0),
      });
    } catch (err) {
      // An empty week and a failed fetch render identically, so this has to be
      // stated rather than swallowed (CLAUDE.md §5).
      setWeeklyStatsError(loadErrorCopy(err, 'this week'));
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      // `loadUserData` is deliberately NOT called here. The root layout loads
      // it and gates rendering on `dataLoaded`, so by the time Home mounts it
      // has already run — calling it again doubled the cold-start payload
      // (12-14 queries where 6-7 suffice) and fired a second whole-store
      // `set()`. On a slow link the duplicate could also land after a user
      // action and silently revert it. The "Continue learning" tiles stay
      // fresh through the focus effect above.
      loadWeeklyStats(user.id);
      // School data is supplementary on this screen — a failure must not take
      // the home tab down, but the store now throws so it has to be caught.
      if (schoolEnabled) {
        loadStudentSchoolData(user.id).catch((err) =>
          console.error('[home] school data load failed:', err),
        );
      }
    }
  }, [user?.id, loadWeeklyStats, loadStudentSchoolData, schoolEnabled]);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        style={styles.root}
        // 120 keeps the last card clear of the floating tab bar.
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView edges={['top']} style={styles.stack}>
          <HomeHeader greeting={greeting} name={profile?.displayName} />

          <LevelDueRow
            band={band}
            nextBand={level.progress?.next ?? null}
            progressPercent={level.progress?.percent ?? null}
            measured={level.measured}
            dueCount={reviewCount}
            onReview={() => router.push('/learn/review' as any)}
          />

          <SessionHero
            title={nextTile?.title ?? 'Your next lesson'}
            // Real minutes against the learner's own goal. `minutes_practiced`
            // is written by `hooks/useActiveTime.ts` from every practice screen.
            minutesToday={dailyStats?.minutesPracticed ?? 0}
            goalMinutes={profile?.dailyGoalMinutes ?? DEFAULT_DAILY_GOAL_MINUTES}
            // The learner's own goal when they gave one; the band's can-do
            // line otherwise. The level card above keeps the can-do pairing
            // either way, so a bare band never stands alone on the page.
            subtitle={heroSubtitle(profile?.idealL2Self, cefrCanDo(band))}
            onStart={() =>
              router.push((nextTile?.nextLessonId ? `/learn/${nextTile.nextLessonId}` : '/learn') as any)
            }
          />

          <ReadRow
            title={article?.title ?? null}
            minutes={readMinutes(article?.content)}
            loading={newsLoading}
            error={newsError}
            hasRead={newsHasRead}
            onPress={() => {
              if (article) {
                router.push({ pathname: '/news/[date]', params: { date: article.date } } as any);
              }
            }}
          />

          <UnitRows
            tiles={lessonTiles}
            loading={tilesLoading}
            error={tilesError}
            onRetry={refetchTiles}
            onOpen={(tile) => router.push((tile.nextLessonId ? `/learn/${tile.nextLessonId}` : '/learn') as any)}
            onAll={() => router.push('/learn' as any)}
          />

          <PatternsCard
            mistakes={insights.mistakes}
            words={insights.words}
            loading={insights.loading}
            error={insights.error}
            onRetry={insights.retry}
            onOpen={() => router.push('/profile/patterns' as any)}
            onReviewWords={() => {
              trackEvent('review_started', { count: insights.words.length, source: 'struggling' });
              router.push({ pathname: '/learn/review', params: { mode: 'struggling' } } as any);
            }}
          />

          <DailyThree items={challenges} />

          <WeekStrip
            stats={weeklyStats}
            error={weeklyStatsError}
            onRetry={() => { if (user?.id) loadWeeklyStats(user.id); }}
          />

          <View style={styles.stack}>
            <SectionTitle title="Practice" />
            <ActionRow
              index={0}
              icon="chatbubbles-outline"
              tint="primary"
              title="Talk with your tutor"
              subtitle="A real conversation, corrected as you go"
              onPress={() => router.push('/chat' as any)}
            />
            {/* Hands-free. This is the only entry point into the eyes-free
                session, and the only route into the `/practice` group at all
                (the tab is `href: null`); removing it makes the feature
                unreachable rather than hidden. */}
            {HANDSFREE_ENABLED && (
              <ActionRow
                index={1}
                icon="headset-outline"
                tint="pink"
                title="Hands-free practice"
                subtitle="Speak and listen — no screen needed"
                onPress={() => router.push('/practice/handsfree' as any)}
                accessibilityHint="Runs a spoken review session you can do without looking at the screen"
              />
            )}
          </View>
        </SafeAreaView>
      </ScrollView>

      {/* Pre-permission sheet — shown once, post-first-lesson, before the
          iOS system notification prompt. Lifts opt-in ~2-3× vs cold-firing. */}
      <PrePermissionSheet
        visible={showPrePermission}
        onEnable={handleEnableReminders}
        onDismiss={handleDismissPrePermission}
      />

      {/* Floating onboarding checklist FAB */}
      <OnboardingChecklistFab />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 },
  stack: { gap: 18 },
});
