import { View, ScrollView, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
  fetchCourses,
  fetchUnits,
  fetchLessonsForUnits,
  fetchReadingPassagesByCourse,
  fetchWritingPromptsByCourse,
  fetchBooksByLanguageAndLevel,
  fetchBooksRankedByCoverage,
  fetchGoalTrack,
  fetchInProgressBooks,
  fetchUserBookProgress,
} from '../../../lib/supabase-queries';
import { useAppStore } from '../../../stores/useAppStore';
import { useReviewCountSync } from '../../../hooks/useReviewCountSync';
import { supabase } from '../../../lib/supabase';
import { cachedFetch, readCacheKey } from '../../../lib/read-cache';
import { GoalTrackCard, GoalTrackPrompt } from '../../../components/learn/GoalTrackCard';
import { materializeGoalLesson, resolveGoalTrack } from '../../../lib/ai';
import { trackEvent, trackRefusal } from '../../../lib/analytics';
import { Ui2EmptyState } from '../../../components/ui2/Ui2EmptyState';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { UnitPath } from '../../../components/learn/UnitPath';
import { CoursePills, TabPills } from '../../../components/learn/SelectorPills';
import { ReviewShortcut } from '../../../components/learn/ReviewShortcut';
import { Heading, Body, Caption, Hero } from '../../../components/ui2/Ui2Text';
import { Ui2Badge } from '../../../components/ui2/Ui2Badge';
import { Ui2InlineError } from '../../../components/ui2/Ui2InlineError';
import { loadErrorCopy, saveErrorCopy, type ErrorCopy } from '../../../lib/error-copy';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to. `radii` and
// `spacing` are plain scheme-independent numbers and carry over unchanged.
import { spacing, radii } from '../../../config/theme';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import type { Course, Unit, Lesson, ReadingPassage, WritingPrompt, ReadingBook, UserBookProgress, GoalTrack } from '../../../types';
import { Ionicons } from '@expo/vector-icons';
import { BookCard } from '../../../components/reading/BookCard';
import { ContinueReadingSection } from '../../../components/reading/ContinueReadingSection';
import { cefrCanDo, cefrAccessibilityLabel } from '../../../lib/cefr-labels';
import { useScreenView } from '../../../hooks/useScreenView';


type CourseTab = 'vocab' | 'reading' | 'writing';

const TAB_CONFIG: { key: CourseTab; label: string }[] = [
  { key: 'vocab', label: 'Vocab' },
  { key: 'reading', label: 'Reading' },
  { key: 'writing', label: 'Writing' },
];

/**
 * The default library shelf: ordered by how much of each book the learner can
 * already read, rather than by when it was imported.
 *
 * Not a CEFR band, so it sits outside the ['A1'..'C2'] list and is compared by
 * identity everywhere a band would be.
 */
const FOR_YOU_TAB = 'for-you';

export default function LearnScreen() {
  useScreenView('learn');
  const { c } = useUi2Theme();
  const router = useRouter();
  const { reviewCount, profile } = useAppStore();
  // The review screen and the lesson warm-up both clear cards without this
  // screen knowing, so re-read the due count whenever it comes back into view.
  useReviewCountSync();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [units, setUnits] = useState<Record<string, { unit: Unit; lessons: Lesson[] }[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [activeTab, setActiveTab] = useState<CourseTab>('vocab');
  const [readingPassages, setReadingPassages] = useState<Record<string, ReadingPassage[]>>({});
  const [writingPrompts, setWritingPrompts] = useState<Record<string, WritingPrompt[]>>({});
  const [libraryBooks, setLibraryBooks] = useState<ReadingBook[]>([]);
  // 'for-you' is the default shelf: the library is 10,375 books, most of them
  // unreadable for most learners, so ordering by how much of each one they can
  // already read is the thing that makes it a shelf rather than a pile. The
  // CEFR pills stay for browsing by band.
  const [selectedCefrTab, setSelectedCefrTab] = useState<string>(FOR_YOU_TAB);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  /** True when 'For you' had nothing to rank and fell back to the A1 shelf. */
  const [rankedUnavailable, setRankedUnavailable] = useState(false);
  const [goalTrack, setGoalTrack] = useState<GoalTrack | null>(null);
  const [buildingTrack, setBuildingTrack] = useState(false);
  const [goalTrackError, setGoalTrackError] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<ErrorCopy | null>(null);
  const [unitsError, setUnitsError] = useState<ErrorCopy | null>(null);
  const [passagesError, setPassagesError] = useState<ErrorCopy | null>(null);
  const [promptsError, setPromptsError] = useState<ErrorCopy | null>(null);
  const [generateError, setGenerateError] = useState<ErrorCopy | null>(null);
  const [inProgressBooks, setInProgressBooks] = useState<{ book: ReadingBook; progress: UserBookProgress }[]>([]);
  const [bookProgressMap, setBookProgressMap] = useState<Map<string, UserBookProgress>>(new Map());

  // Load courses on mount
  useEffect(() => {
    const targetLang = profile?.targetLanguage;
    fetchCourses(targetLang)
      .then((data) => {
        setCourses(data);
        if (data.length > 0) {
          setSelectedCourseId(data[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [profile?.targetLanguage]);

  // Load units + lessons when course is selected
  const loadCourseContent = useCallback(async (courseId: string) => {
    if (units[courseId]) return; // already loaded
    setLoadingUnits(true);
    setUnitsError(null);
    try {
      const courseUnits = await fetchUnits(courseId);
      // One query for every unit's lessons, not one per unit.
      const byUnit = await fetchLessonsForUnits(courseUnits.map((u) => u.id));
      const lessonResults = courseUnits.map((unit) => ({
        unit,
        lessons: byUnit.get(unit.id) ?? [],
      }));
      setUnits((prev) => ({ ...prev, [courseId]: lessonResults }));
    } catch (err) {
      // An empty lesson path and an outage look identical to a learner, so
      // this has to be visible rather than swallowed.
      setUnitsError(loadErrorCopy(err, 'your lessons'));
    } finally {
      setLoadingUnits(false);
    }
  }, [units]);

  useEffect(() => {
    if (selectedCourseId) {
      loadCourseContent(selectedCourseId);
    }
  }, [selectedCourseId, loadCourseContent]);

  const loadPassages = useCallback(async (courseId: string) => {
    setPassagesError(null);
    try {
      const passages = await fetchReadingPassagesByCourse(courseId);
      setReadingPassages((prev) => ({ ...prev, [courseId]: passages }));
    } catch (err) {
      setPassagesError(loadErrorCopy(err, 'the reading passages'));
    }
  }, []);

  const loadPrompts = useCallback(async (courseId: string) => {
    setPromptsError(null);
    try {
      const prompts = await fetchWritingPromptsByCourse(courseId);
      setWritingPrompts((prev) => ({ ...prev, [courseId]: prompts }));
    } catch (err) {
      setPromptsError(loadErrorCopy(err, 'the writing prompts'));
    }
  }, []);

  const selectTab = async (tab: CourseTab) => {
    setActiveTab(tab);
    if (!selectedCourseId) return;

    if (tab === 'reading' && !readingPassages[selectedCourseId]) {
      await loadPassages(selectedCourseId);
      // Also load library books and in-progress books
      loadLibraryBooks(selectedCefrTab);
      loadInProgressBooks();
    }
    if (tab === 'writing' && !writingPrompts[selectedCourseId]) {
      await loadPrompts(selectedCourseId);
    }
  };

  const loadLibraryBooks = async (cefrLevel: string) => {
    if (!profile?.targetLanguage) return;
    setLoadingLibrary(true);
    setLibraryError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      // The ranked shelf comes back already ordered by coverage; the CEFR
      // shelves keep the existing newest-first ordering within a band.
      //
      // Stale-while-revalidate on the ranked one: the ordering is a pure
      // function of the learner's retained words, which change a handful of
      // times a day at most, so the previous order paints immediately and the
      // refresh lands behind it. It is also the slower query — the intersection
      // runs across every book in the language once a learner actually has
      // retained words.
      let books: ReadingBook[];
      if (cefrLevel === FOR_YOU_TAB) {
        const { data } = await cachedFetch<ReadingBook[]>(
          readCacheKey('books-ranked', userId ?? 'anon', profile.targetLanguage),
          async () =>
            (await fetchBooksRankedByCoverage(profile.targetLanguage!)).map((r) => r.book),
          { onCached: (cached) => { setLibraryBooks(cached); setLoadingLibrary(false); } },
        );
        // Empty means the language has no vocabulary profiles — Chinese,
        // Japanese and Korean have none by design (whitespace tokenization
        // cannot segment them), and a language mid-rebuild has none yet. Fall
        // back to the level shelf rather than showing a learner an empty
        // library and letting them conclude there are no books.
        books =
          data.length > 0
            ? data
            : await fetchBooksByLanguageAndLevel(profile.targetLanguage, 'A1');
        setRankedUnavailable(data.length === 0);
      } else {
        books = await fetchBooksByLanguageAndLevel(profile.targetLanguage, cefrLevel);
        setRankedUnavailable(false);
      }
      setLibraryBooks(books);

      if (userId) {
        const allProgress = await fetchUserBookProgress(userId);
        const progressMap = new Map<string, UserBookProgress>();
        for (const p of allProgress) {
          progressMap.set(p.bookId, p);
        }
        setBookProgressMap(progressMap);
      }
    } catch (err) {
      setLibraryError(loadErrorCopy(err, 'the library'));
    } finally {
      setLoadingLibrary(false);
    }
  };

  const loadInProgressBooks = async () => {
    if (!profile?.targetLanguage) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return;
      const books = await fetchInProgressBooks(userId, profile.targetLanguage);
      setInProgressBooks(books);
    } catch (err) {
      setLibraryError(loadErrorCopy(err, 'your books in progress'));
    }
  };

  const retryLibrary = () => {
    setLibraryError(null);
    loadLibraryBooks(selectedCefrTab);
    loadInProgressBooks();
  };

  const loadGoalTrack = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return;
      setGoalTrack(await fetchGoalTrack(userId));
    } catch (err) {
      // Non-fatal: the goal track is an addition to Learn, not Learn itself.
      // A failure here must not take the lesson path down with it.
      console.warn('[learn] goal track load failed:', err);
    }
  }, []);

  useEffect(() => {
    loadGoalTrack();
  }, [loadGoalTrack]);

  const handleBuildTrack = useCallback(async () => {
    if (!profile?.targetLanguage || buildingTrack) return;
    setBuildingTrack(true);
    setGoalTrackError(null);
    try {
      await resolveGoalTrack(
        profile.targetLanguage,
        profile.nativeLanguage ?? 'en',
        profile.level ?? 'A1',
      );
      await loadGoalTrack();
      trackEvent('goal_track_requested', {
        ok: true,
        language: profile.targetLanguage,
        band: profile.level ?? undefined,
      });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      // UPGRADE_REQUIRED here is a paywall view with intent behind it — the
      // learner asked for the feature by name. Worth separating from a paywall
      // someone merely scrolled past.
      trackRefusal(code ?? 'GOAL_TRACK_FAILED', {
        screen: 'learn',
        language: profile.targetLanguage,
      });
      setGoalTrackError(
        code === 'UPGRADE_REQUIRED'
          ? 'Goal lessons are part of a paid plan.'
          : code === 'UNMAPPABLE_GOAL'
            ? "We couldn't turn that goal into lessons. Try describing the moment more concretely in Settings."
            : // Everything else, GOAL_TRACK_UNAVAILABLE included, is ours to
              // own. Never send a learner off rewriting a goal that was fine.
              "That didn't work on our side. Please try again in a moment.",
      );
    } finally {
      setBuildingTrack(false);
    }
  }, [profile?.targetLanguage, profile?.nativeLanguage, profile?.level, buildingTrack, loadGoalTrack]);

  const goToReview = useCallback(() => {
    router.push('/learn/review' as never);
  }, [router]);

  const handleCefrTabChange = (level: string) => {
    setSelectedCefrTab(level);
    loadLibraryBooks(level);
  };

  if (loading) {
    // Was <LoadingScreen>, which is a Dark Glow component: it paints `bg-dark`
    // and a fixed indigo spinner, so it would stay black on a light phone.
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView className="flex-1 items-center justify-center" edges={['top']}>
          <ActivityIndicator size="large" color={c.primary} />
          <Body size="sm" tone="tertiary" style={{ marginTop: spacing.md }}>Loading courses...</Body>
        </SafeAreaView>
      </View>
    );
  }

  const courseUnits = selectedCourseId ? units[selectedCourseId] : undefined;
  const selectedCourseCanDo = cefrCanDo(courses.find((k) => k.id === selectedCourseId)?.cefrLevel);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header — title, course level, content tab. Fixed above the
            scrolling tab content so switching tabs never moves it. */}
        {/* Dense header (canvas "Learn · variations", L2, 2026-09-08): the
            title and the course pills share one line, the selected course's
            can-do line sits under the whole row, and the content tabs are
            the compact pills. Nothing moved out: same title, same courses,
            same caption, same three tabs. */}
        <View style={{ paddingTop: spacing.xxs, gap: spacing.xs }}>
          <View style={styles.headerRow}>
            <Hero accessibilityRole="header">Learn</Hero>
            <View style={styles.headerPills}>
              <CoursePills
                courses={courses}
                selectedCourseId={selectedCourseId}
                onSelect={setSelectedCourseId}
                compact
              />
            </View>
          </View>

          {selectedCourseCanDo ? (
            <Caption size="sm" tone="tertiary" style={styles.headerCaption}>
              {selectedCourseCanDo}
            </Caption>
          ) : null}

          <TabPills tabs={TAB_CONFIG} activeKey={activeTab} onSelect={selectTab} compact />
        </View>

        {/* Content area */}
        {courses.length === 0 ? (
          <Ui2EmptyState
            icon="book-outline"
            title="No courses yet"
            description="There are no courses for this language yet. Check back soon."
          />
        ) : activeTab === 'vocab' ? (
          /* Vocab tab — unit carousel over the selected unit's lessons */
          loadingUnits ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={c.primary} />
              <Body size="sm" tone="tertiary" style={{ marginTop: spacing.md }}>Loading lessons...</Body>
            </View>
          ) : unitsError ? (
            <Ui2InlineError
              copy={unitsError}
              onRetry={() => { if (selectedCourseId) loadCourseContent(selectedCourseId); }}
            />
          ) : courseUnits && selectedCourseId ? (
            <UnitPath
              units={courseUnits}
              courseId={selectedCourseId}
              header={
                <>
                  <ReviewShortcut count={reviewCount} onPress={goToReview} />
                  {goalTrack ? (
                    <GoalTrackCard
                      track={goalTrack}
                      onOpenLesson={(lessonId) => {
                        trackEvent('goal_track_lesson_opened', {
                          contentId: lessonId,
                          language: profile?.targetLanguage,
                        });
                        return materializeGoalLesson(lessonId, profile?.nativeLanguage ?? 'en');
                      }}
                      onNavigate={(lessonId) => router.push(`/learn/${lessonId}` as never)}
                    />
                  ) : profile?.idealL2Self ? (
                    <GoalTrackPrompt
                      goalText={profile.idealL2Self}
                      isBuilding={buildingTrack}
                      error={goalTrackError}
                      onBuild={handleBuildTrack}
                    />
                  ) : null}
                </>
              }
            />
          ) : null
        ) : activeTab === 'reading' ? (
          /* Reading tab */
          <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
            <ReviewShortcut count={reviewCount} onPress={goToReview} />
            {passagesError && (
              <Ui2InlineError
                copy={passagesError}
                onRetry={() => { if (selectedCourseId) loadPassages(selectedCourseId); }}
              />
            )}

            {/* Continue Reading Section */}
            {inProgressBooks.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <ContinueReadingSection
                  books={inProgressBooks}
                  onPress={(bookId) => router.push(`/learn/reading/book/${bookId}` as any)}
                />
              </View>
            )}

            {/* Passages Section */}
            {selectedCourseId && readingPassages[selectedCourseId]?.length > 0 && (
              <>
                <Heading level={3} style={{ marginTop: spacing.xs, marginBottom: spacing.xs }}>Passages</Heading>
                {readingPassages[selectedCourseId].map((passage) => (
                  <SlabCard key={passage.id} style={{ marginBottom: 8, padding: 0 }}>
                    <Pressable
                      className="p-4 flex-row items-center"
                      onPress={() => router.push(`/learn/reading/${passage.id}` as any)}
                      accessibilityRole="button"
                      // The row's badge is code-only for width; VoiceOver gets
                      // the level's meaning from the row itself.
                      accessibilityLabel={`${passage.title}. ${passage.wordCount} words. ${cefrAccessibilityLabel(passage.cefrLevel)}`}
                    >
                      <Ionicons name="reader-outline" size={22} color={c.primary} />
                      <View className="flex-1 ml-3">
                        <Body weight="medium">{passage.title}</Body>
                        <View className="flex-row flex-wrap items-center gap-2 mt-1">
                          <Body size="sm" tone="secondary">{passage.wordCount} words</Body>
                          <Ui2Badge label={passage.cefrLevel} />
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={c.idle} />
                    </Pressable>
                  </SlabCard>
                ))}
              </>
            )}

            {/* Library Section */}
            <Heading level={3} style={{ marginTop: spacing.md, marginBottom: spacing.xs + 2 }}>
              Library
            </Heading>

            {selectedCefrTab === FOR_YOU_TAB && (
              <Caption size="sm" tone="tertiary" style={{ marginBottom: spacing.xs }}>
                {rankedUnavailable
                  ? 'Ranking is not available for this language yet — showing the A1 shelf.'
                  : 'Ordered by how many of the words you already know.'}
              </Caption>
            )}

            {/* Shelf pills — 'For you' first, then the CEFR bands */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm + 2 }}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {[FOR_YOU_TAB, 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => {
                  const isActive = selectedCefrTab === level;
                  const count = isActive ? libraryBooks.length : null;
                  const isForYou = level === FOR_YOU_TAB;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => handleCefrTabChange(level)}
                      accessibilityRole="tab"
                      accessibilityLabel={
                        isForYou
                          ? 'Books ordered by how much of them you can already read'
                          : cefrAccessibilityLabel(level)
                      }
                      accessibilityState={{ selected: isActive }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        minHeight: 44,
                        paddingVertical: spacing.xs,
                        paddingHorizontal: spacing.md,
                        borderRadius: radii.pill,
                        backgroundColor: isActive ? c.primary : c.track,
                      }}
                    >
                      <Body
                        size="sm"
                        weight="semibold"
                        style={{
                          color: isActive ? c.onPrimary : c.muted,
                        }}
                      >
                        {isForYou ? 'For you' : level}
                      </Body>
                      {isActive && count !== null && count > 0 && (
                        <View
                          style={{
                            marginLeft: 6,
                            // The slab edge colour: a darker step of `primary`,
                            // so the count reads as a well inside the pill in
                            // both schemes without a white wash that vanishes
                            // on a light background.
                            backgroundColor: c.slab,
                            borderRadius: 10,
                            minWidth: 20,
                            minHeight: 20,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 6,
                          }}
                        >
                          <Caption size="sm" tone="onPrimary" style={{ fontWeight: '700' }}>
                            {count}
                          </Caption>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Six letter codes in a row explain nothing on their own, and the
                pills are too narrow to carry a sentence each. This states the
                selected one, so the row is readable rather than decoded. */}
            <Body size="sm" tone="tertiary" style={{ marginBottom: spacing.sm }}>
              {cefrCanDo(selectedCefrTab)}
            </Body>

            {loadingLibrary ? (
              <Body size="sm" tone="tertiary" style={{ paddingVertical: spacing.md }}>Loading library...</Body>
            ) : libraryError ? (
              /* Non-blocking library error — distinct from "no books yet" */
              <Ui2InlineError copy={libraryError} onRetry={retryLibrary} />
            ) : libraryBooks.length === 0 ? (
              <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                <Body size="sm" tone="tertiary" style={{ marginBottom: spacing.sm }}>
                  No books available for this level yet.
                </Body>
                <Pressable
                  onPress={async () => {
                    if (!profile?.targetLanguage) return;
                    setLoadingLibrary(true);
                    setGenerateError(null);
                    try {
                      const { error } = await supabase.functions.invoke('generate-story', {
                        body: { language: profile.targetLanguage, cefrLevel: selectedCefrTab, count: 3 },
                      });
                      if (error) throw error;
                      await loadLibraryBooks(selectedCefrTab);
                    } catch (err) {
                      setGenerateError(saveErrorCopy(err, 'new stories'));
                    } finally {
                      setLoadingLibrary(false);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Generate stories for this level"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: c.primary,
                    borderRadius: radii.lg,
                    paddingHorizontal: spacing.md + spacing.xxs,
                    paddingVertical: spacing.sm,
                  }}
                >
                  <Ionicons name="sparkles" size={18} color={c.onPrimary} />
                  <Body size="sm" tone="onPrimary" weight="semibold" style={{ marginLeft: spacing.xs }}>
                    Generate Stories
                  </Body>
                </Pressable>
                {/* The button above is its own retry, so this states the
                    failure without repeating the affordance. */}
                {generateError && (
                  <View style={{ marginTop: spacing.sm, paddingHorizontal: spacing.md }}>
                    <Body size="sm" weight="semibold" tone="error">{generateError.title}</Body>
                    <Body size="sm" tone="tertiary">{generateError.message}</Body>
                  </View>
                )}
              </View>
            ) : (
              <FlatList
                data={libraryBooks}
                numColumns={2}
                scrollEnabled={false}
                keyExtractor={(item) => item.id}
                columnWrapperStyle={{ gap: 12 }}
                renderItem={({ item }) => (
                  <BookCard
                    book={item}
                    progress={bookProgressMap.get(item.id) ?? null}
                    onPress={() => {
                      trackEvent('reading_book_opened', {
                        contentId: item.id,
                        language: item.language,
                        band: item.cefrLevel,
                      });
                      router.push(`/learn/reading/book/${item.id}` as any);
                    }}
                  />
                )}
              />
            )}
          </ScrollView>
        ) : activeTab === 'writing' ? (
          /* Writing tab */
          <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
            <ReviewShortcut count={reviewCount} onPress={goToReview} />
            {/* History Link */}
            <SlabCard style={{ marginBottom: 12, padding: 0 }}>
              <Pressable
                className="p-4 flex-row items-center"
                onPress={() => router.push('/learn/writing/history' as any)}
                accessibilityRole="button"
                accessibilityLabel="View writing history"
              >
                <Ionicons name="time-outline" size={20} color={c.primary} />
                <Body size="sm" weight="semibold" tone="accent" style={{ marginLeft: spacing.xs }}>View Writing History</Body>
                <View className="flex-1" />
                <Ionicons name="chevron-forward" size={16} color={c.primary} />
              </Pressable>
            </SlabCard>

            {!selectedCourseId ? null : promptsError ? (
              <Ui2InlineError
                copy={promptsError}
                onRetry={() => loadPrompts(selectedCourseId)}
              />
            ) : !writingPrompts[selectedCourseId] ? (
              <Body size="sm" tone="secondary" style={{ paddingVertical: spacing.md }}>Loading prompts...</Body>
            ) : writingPrompts[selectedCourseId].length === 0 ? (
              <Body size="sm" tone="secondary" style={{ paddingVertical: spacing.md }}>No writing prompts available yet.</Body>
            ) : (
              writingPrompts[selectedCourseId].map((prompt) => (
                <SlabCard key={prompt.id} style={{ marginBottom: 8, padding: 0 }}>
                  <Pressable
                    className="p-4 flex-row items-center"
                    onPress={() => router.push(`/learn/writing/${prompt.id}` as any)}
                    accessibilityRole="button"
                    accessibilityLabel={`${prompt.promptText}. ${cefrAccessibilityLabel(prompt.cefrLevel)}`}
                  >
                    <Ionicons name="create-outline" size={22} color={c.primary} />
                    <View className="flex-1 ml-3">
                      <Body weight="medium">
                        {prompt.promptText}
                      </Body>
                      <View className="flex-row flex-wrap items-center gap-2 mt-1">
                        <Body size="sm" tone="secondary">
                          {prompt.minWords ?? '?'}-{prompt.maxWords ?? '?'} words
                        </Body>
                        <Ui2Badge label={prompt.cefrLevel} />
                        <Ui2Badge label={prompt.promptType} />
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={c.idle} />
                  </Pressable>
                </SlabCard>
              ))
            )}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
  },
  headerPills: {
    flex: 1,
    minWidth: 0,
  },
  headerCaption: {
    paddingHorizontal: spacing.md,
  },
});
