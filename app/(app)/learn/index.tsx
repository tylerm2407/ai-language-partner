import { View, Text, ScrollView, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
  fetchCourses,
  fetchUnits,
  fetchLessons,
  fetchReadingPassagesByCourse,
  fetchWritingPromptsByCourse,
  fetchBooksByLanguageAndLevel,
  fetchInProgressBooks,
  fetchUserBookProgress,
} from '../../../lib/supabase-queries';
import { useAppStore } from '../../../stores/useAppStore';
import { useReviewCountSync } from '../../../hooks/useReviewCountSync';
import { supabase } from '../../../lib/supabase';
import { LoadingScreen } from '../../../components/ui/LoadingScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../components/ui/GlassSurface';
import { UnitPath } from '../../../components/learn/UnitPath';
import { CoursePills, TabPills } from '../../../components/learn/SelectorPills';
import { ReviewShortcut } from '../../../components/learn/ReviewShortcut';
import { Heading, Body, Caption, Hero } from '../../../components/ui/Text';
import { loadErrorCopy, saveErrorCopy, type ErrorCopy } from '../../../lib/error-copy';
import { colors, spacing, radii } from '../../../config/theme';
import type { Course, Unit, Lesson, ReadingPassage, WritingPrompt, ReadingBook, UserBookProgress } from '../../../types';
import { Ionicons } from '@expo/vector-icons';
import { BookCard } from '../../../components/reading/BookCard';
import { ContinueReadingSection } from '../../../components/reading/ContinueReadingSection';

const CEFR_COLORS: Record<string, { bg: string; text: string }> = {
  A1: { bg: 'bg-success-bg', text: 'text-success' },
  A2: { bg: 'bg-primary-tint', text: 'text-primary' },
  B1: { bg: 'bg-warning-bg', text: 'text-warning' },
  B2: { bg: 'bg-error-bg', text: 'text-error' },
};

/**
 * Inline failure state with a retry, used everywhere this screen loads
 * something. Preferred over `Alert.alert('Error', …)`: the learner keeps the
 * screen they were on, the copy says what to do next, and the retry is one tap
 * away rather than a full re-navigation (CLAUDE.md §5).
 */
function InlineError({
  copy,
  onRetry,
  retryLabel = 'Try again',
}: {
  copy: ErrorCopy;
  onRetry: () => void;
  retryLabel?: string;
}) {
  return (
    <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.md,
        }}
      >
        <Ionicons name="alert-circle" size={16} color={colors.error.base} style={{ marginTop: 2 }} />
        <View style={{ marginLeft: spacing.xxs, flexShrink: 1 }}>
          <Body size="sm" weight="semibold" tone="error">{copy.title}</Body>
          <Body size="sm" tone="tertiary">{copy.message}</Body>
        </View>
      </View>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
        style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md }}
      >
        <Body size="sm" weight="semibold" tone="accent">{retryLabel}</Body>
      </Pressable>
    </View>
  );
}

type CourseTab = 'vocab' | 'reading' | 'writing';

const TAB_CONFIG: { key: CourseTab; label: string }[] = [
  { key: 'vocab', label: 'Vocab' },
  { key: 'reading', label: 'Reading' },
  { key: 'writing', label: 'Writing' },
];

export default function LearnScreen() {
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
  const [selectedCefrTab, setSelectedCefrTab] = useState<string>('A1');
  const [loadingLibrary, setLoadingLibrary] = useState(false);
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
      const lessonResults = await Promise.all(
        courseUnits.map((unit) =>
          fetchLessons(unit.id).then((ls) => ({ unit, lessons: ls }))
        )
      );
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
      const books = await fetchBooksByLanguageAndLevel(profile.targetLanguage, cefrLevel);
      setLibraryBooks(books);

      // Fetch progress for all books
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
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

  const goToReview = useCallback(() => {
    router.push('/learn/review' as never);
  }, [router]);

  const handleCefrTabChange = (level: string) => {
    setSelectedCefrTab(level);
    loadLibraryBooks(level);
  };

  if (loading) {
    return <LoadingScreen message="Loading courses..." />;
  }

  const courseUnits = selectedCourseId ? units[selectedCourseId] : undefined;

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header — title, course level, content tab. Fixed above the
            scrolling tab content so switching tabs never moves it. */}
        <View style={{ paddingTop: spacing.xxs }}>
          <Hero
            accessibilityRole="header"
            style={{ marginBottom: spacing.sm, marginHorizontal: spacing.md }}
          >
            Learn
          </Hero>

          <CoursePills
            courses={courses}
            selectedCourseId={selectedCourseId}
            onSelect={setSelectedCourseId}
          />

          <View style={{ height: spacing.xs }} />

          <TabPills tabs={TAB_CONFIG} activeKey={activeTab} onSelect={selectTab} />
        </View>

        {/* Content area */}
        {courses.length === 0 ? (
          <EmptyState
            icon="book-outline"
            title="No courses yet"
            description="There are no courses for this language yet. Check back soon."
          />
        ) : activeTab === 'vocab' ? (
          /* Vocab tab — unit carousel over the selected unit's lessons */
          loadingUnits ? (
            <LoadingScreen message="Loading lessons..." />
          ) : unitsError ? (
            <InlineError
              copy={unitsError}
              onRetry={() => { if (selectedCourseId) loadCourseContent(selectedCourseId); }}
            />
          ) : courseUnits && selectedCourseId ? (
            <UnitPath
              units={courseUnits}
              courseId={selectedCourseId}
              header={<ReviewShortcut count={reviewCount} onPress={goToReview} />}
            />
          ) : null
        ) : activeTab === 'reading' ? (
          /* Reading tab */
          <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
            <ReviewShortcut count={reviewCount} onPress={goToReview} />
            {passagesError && (
              <InlineError
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
                <Text className="text-lg font-bold text-text-primary mb-2 mt-2">Passages</Text>
                {readingPassages[selectedCourseId].map((passage) => (
                  <GlassSurface key={passage.id} style={{ marginBottom: 8 }}>
                    <Pressable
                      className="p-4 flex-row items-center"
                      onPress={() => router.push(`/learn/reading/${passage.id}` as any)}
                      accessibilityRole="button"
                      accessibilityLabel={passage.title}
                    >
                      <Ionicons name="reader-outline" size={22} color={colors.league.diamond} />
                      <View className="flex-1 ml-3">
                        <Text className="text-base font-medium text-text-primary">{passage.title}</Text>
                        <View className="flex-row flex-wrap items-center gap-2 mt-1">
                          <Text className="text-sm text-text-secondary">{passage.wordCount} words</Text>
                          <View className={`${CEFR_COLORS[passage.cefrLevel]?.bg ?? 'bg-surface'} rounded-md px-1.5 py-0.5`}>
                            <Text className={`${CEFR_COLORS[passage.cefrLevel]?.text ?? 'text-text-secondary'} text-xs font-sans-bold`}>
                              {passage.cefrLevel}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.correctionChip.grammar.text} />
                    </Pressable>
                  </GlassSurface>
                ))}
              </>
            )}

            {/* Library Section */}
            <Heading level={3} style={{ marginTop: spacing.md, marginBottom: spacing.xs + 2 }}>
              Library
            </Heading>

            {/* CEFR Level Sub-tabs — pill style */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm + 2 }}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => {
                  const isActive = selectedCefrTab === level;
                  const count = isActive ? libraryBooks.length : null;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => handleCefrTabChange(level)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isActive }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        minHeight: 44,
                        paddingVertical: spacing.xs,
                        paddingHorizontal: spacing.md,
                        borderRadius: radii.pill,
                        backgroundColor: isActive ? colors.action.primaryFill : colors.surface.cardAlt,
                      }}
                    >
                      <Body
                        size="sm"
                        weight="semibold"
                        style={{
                          color: isActive ? colors.text.onPrimary : colors.text.tertiary,
                        }}
                      >
                        {level}
                      </Body>
                      {isActive && count !== null && count > 0 && (
                        <View
                          style={{
                            marginLeft: 6,
                            backgroundColor: 'rgba(255,255,255,0.25)',
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

            {loadingLibrary ? (
              <Body size="sm" tone="tertiary" style={{ paddingVertical: spacing.md }}>Loading library...</Body>
            ) : libraryError ? (
              /* Non-blocking library error — distinct from "no books yet" */
              <InlineError copy={libraryError} onRetry={retryLibrary} />
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
                    backgroundColor: colors.action.primaryFill,
                    borderRadius: radii.lg,
                    paddingHorizontal: spacing.md + spacing.xxs,
                    paddingVertical: spacing.sm,
                  }}
                >
                  <Ionicons name="sparkles" size={18} color={colors.text.onPrimary} />
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
                    onPress={() => router.push(`/learn/reading/book/${item.id}` as any)}
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
            <GlassSurface style={{ marginBottom: 12 }}>
              <Pressable
                className="p-4 flex-row items-center"
                onPress={() => router.push('/learn/writing/history' as any)}
                accessibilityRole="button"
                accessibilityLabel="View writing history"
              >
                <Ionicons name="time-outline" size={20} color={colors.action.accent} />
                <Text className="text-sm font-sans-semibold text-primary ml-2">View Writing History</Text>
                <View className="flex-1" />
                <Ionicons name="chevron-forward" size={16} color={colors.action.accent} />
              </Pressable>
            </GlassSurface>

            {!selectedCourseId ? null : promptsError ? (
              <InlineError
                copy={promptsError}
                onRetry={() => loadPrompts(selectedCourseId)}
              />
            ) : !writingPrompts[selectedCourseId] ? (
              <Text className="text-sm text-text-secondary py-4">Loading prompts...</Text>
            ) : writingPrompts[selectedCourseId].length === 0 ? (
              <Text className="text-sm text-text-secondary py-4">No writing prompts available yet.</Text>
            ) : (
              writingPrompts[selectedCourseId].map((prompt) => (
                <GlassSurface key={prompt.id} style={{ marginBottom: 8 }}>
                  <Pressable
                    className="p-4 flex-row items-center"
                    onPress={() => router.push(`/learn/writing/${prompt.id}` as any)}
                    accessibilityRole="button"
                    accessibilityLabel={prompt.promptText}
                  >
                    <Ionicons name="create-outline" size={22} color={colors.premium.base} />
                    <View className="flex-1 ml-3">
                      <Text className="text-base font-medium text-text-primary">
                        {prompt.promptText}
                      </Text>
                      <View className="flex-row flex-wrap items-center gap-2 mt-1">
                        <Text className="text-sm text-text-secondary">
                          {prompt.minWords ?? '?'}-{prompt.maxWords ?? '?'} words
                        </Text>
                        <View className={`${CEFR_COLORS[prompt.cefrLevel]?.bg ?? 'bg-surface'} rounded-md px-1.5 py-0.5`}>
                          <Text className={`${CEFR_COLORS[prompt.cefrLevel]?.text ?? 'text-text-secondary'} text-xs font-sans-bold`}>
                            {prompt.cefrLevel}
                          </Text>
                        </View>
                        <View className="bg-primary-tint rounded-md px-1.5 py-0.5">
                          <Text className="text-primary text-xs font-sans-bold">{prompt.promptType}</Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.correctionChip.grammar.text} />
                  </Pressable>
                </GlassSurface>
              ))
            )}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </GradientBackground>
  );
}
