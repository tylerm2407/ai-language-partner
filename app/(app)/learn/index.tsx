import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
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
} from '../../../lib/supabase-queries';
import { useAppStore } from '../../../stores/useAppStore';
import { supabase } from '../../../lib/supabase';
import { LoadingScreen } from '../../../components/ui/LoadingScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Badge } from '../../../components/ui/Badge';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GradientBorderCard } from '../../../components/ui/GradientBorderCard';
import { LearningPath } from '../../../components/learning-path/LearningPath';
import type { Course, Unit, Lesson, ReadingPassage, WritingPrompt, ReadingBook } from '../../../types';
import { Ionicons } from '@expo/vector-icons';

const CEFR_LABELS: Record<string, string> = {
  A1: 'Beginner',
  A2: 'Intermediate',
  B1: 'Advanced',
  B2: 'Professor',
};

const CEFR_COLORS: Record<string, { bg: string; text: string }> = {
  A1: { bg: 'bg-success-bg', text: 'text-success' },
  A2: { bg: 'bg-primary-tint', text: 'text-primary' },
  B1: { bg: 'bg-warning-bg', text: 'text-warning' },
  B2: { bg: 'bg-error-bg', text: 'text-error' },
};

type CourseTab = 'vocab' | 'reading' | 'writing';

const TAB_CONFIG: { key: CourseTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'vocab', label: 'Vocab', icon: 'book-outline' },
  { key: 'reading', label: 'Reading', icon: 'reader-outline' },
  { key: 'writing', label: 'Writing', icon: 'create-outline' },
];

export default function LearnScreen() {
  const router = useRouter();
  const { reviewCount, profile } = useAppStore();
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
    try {
      const courseUnits = await fetchUnits(courseId);
      const lessonResults = await Promise.all(
        courseUnits.map((unit) =>
          fetchLessons(unit.id).then((ls) => ({ unit, lessons: ls }))
        )
      );
      setUnits((prev) => ({ ...prev, [courseId]: lessonResults }));
    } catch {
      Alert.alert('Error', 'Failed to load course content. Please try again.');
    } finally {
      setLoadingUnits(false);
    }
  }, [units]);

  useEffect(() => {
    if (selectedCourseId) {
      loadCourseContent(selectedCourseId);
    }
  }, [selectedCourseId, loadCourseContent]);

  const selectTab = async (tab: CourseTab) => {
    setActiveTab(tab);
    if (!selectedCourseId) return;

    if (tab === 'reading' && !readingPassages[selectedCourseId]) {
      try {
        const passages = await fetchReadingPassagesByCourse(selectedCourseId);
        setReadingPassages((prev) => ({ ...prev, [selectedCourseId]: passages }));
      } catch {
        Alert.alert('Error', 'Failed to load reading passages.');
      }
      // Also load library books
      loadLibraryBooks(selectedCefrTab);
    }
    if (tab === 'writing' && !writingPrompts[selectedCourseId]) {
      try {
        const prompts = await fetchWritingPromptsByCourse(selectedCourseId);
        setWritingPrompts((prev) => ({ ...prev, [selectedCourseId]: prompts }));
      } catch {
        Alert.alert('Error', 'Failed to load writing prompts.');
      }
    }
  };

  const loadLibraryBooks = async (cefrLevel: string) => {
    if (!profile?.targetLanguage) return;
    setLoadingLibrary(true);
    try {
      const books = await fetchBooksByLanguageAndLevel(profile.targetLanguage, cefrLevel);
      setLibraryBooks(books);
    } catch {
      // Silent fail
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handleCefrTabChange = (level: string) => {
    setSelectedCefrTab(level);
    loadLibraryBooks(level);
  };

  if (loading) {
    return <LoadingScreen message="Loading courses..." />;
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const courseUnits = selectedCourseId ? units[selectedCourseId] : undefined;

  return (
    <GradientBackground>
      <View className="flex-1">
        {/* Header */}
        <View className="px-4 pt-2 pb-2">
          <Text className="text-[28px] font-bold text-text-primary mb-4" accessibilityRole="header">
            Learn
          </Text>

          {/* Review cards shortcut */}
          {reviewCount > 0 && (
            <Pressable
              className="bg-success-bg rounded-2xl p-5 mb-4 flex-row items-center"
              onPress={() => router.push('/learn/review' as any)}
              accessibilityRole="button"
              accessibilityLabel={`Review ${reviewCount} cards due`}
            >
              <Ionicons name="refresh" size={24} color="#34D399" />
              <View className="ml-4 flex-1">
                <Text className="text-base font-semibold text-text-primary">Review Cards</Text>
                <Text className="text-sm text-text-secondary">{reviewCount} cards due for review</Text>
              </View>
              <Badge variant="success" label={String(reviewCount)} />
            </Pressable>
          )}

          {/* Course selector (horizontal scroll if multiple courses) */}
          {courses.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
              className="mb-2"
            >
              {courses.map((course) => {
                const isSelected = course.id === selectedCourseId;
                return (
                  <Pressable
                    key={course.id}
                    onPress={() => setSelectedCourseId(course.id)}
                    className={`mr-2 px-4 py-3 rounded-xl ${isSelected ? 'bg-primary' : 'bg-dark-card'}`}
                    accessibilityRole="button"
                    accessibilityLabel={course.title}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-text-secondary'}`}
                    >
                      {course.title}
                    </Text>
                    {course.cefrLevel && (
                      <Text
                        className={`text-xs mt-0.5 ${isSelected ? 'text-white/70' : 'text-text-secondary'}`}
                      >
                        {CEFR_LABELS[course.cefrLevel] || course.cefrLevel}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Tab selector */}
          <View className="flex-row gap-2 mb-2">
            {TAB_CONFIG.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => selectTab(tab.key)}
                  className={`flex-row items-center px-3 py-2 rounded-xl ${isActive ? 'bg-primary' : 'bg-dark-card'}`}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: isActive }}
                >
                  <Ionicons name={tab.icon} size={16} color={isActive ? '#FFFFFF' : '#94A3B8'} />
                  <Text
                    className={`text-sm font-sans-semibold ml-1.5 ${isActive ? 'text-white' : 'text-text-secondary'}`}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Content area */}
        {courses.length === 0 ? (
          <EmptyState
            icon="book-outline"
            title="No courses yet"
            description="Courses will appear here once they are published to your Supabase database."
          />
        ) : activeTab === 'vocab' ? (
          /* Vocab tab — Learning Path */
          loadingUnits ? (
            <LoadingScreen message="Loading lessons..." />
          ) : courseUnits && selectedCourseId ? (
            <LearningPath units={courseUnits} courseId={selectedCourseId} />
          ) : null
        ) : activeTab === 'reading' ? (
          /* Reading tab */
          <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
            {/* Passages Section */}
            {selectedCourseId && readingPassages[selectedCourseId]?.length > 0 && (
              <>
                <Text className="text-lg font-bold text-text-primary mb-2 mt-2">Passages</Text>
                {readingPassages[selectedCourseId].map((passage) => (
                  <Pressable
                    key={passage.id}
                    className="bg-dark-card border-2 border-dark-border rounded-[14px] p-4 mb-2 flex-row items-center"
                    onPress={() => router.push(`/learn/reading/${passage.id}` as any)}
                    accessibilityRole="button"
                    accessibilityLabel={passage.title}
                  >
                    <Ionicons name="reader-outline" size={22} color="#38BDF8" />
                    <View className="flex-1 ml-3">
                      <Text className="text-base font-medium text-text-primary">{passage.title}</Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        <Text className="text-sm text-text-secondary">{passage.wordCount} words</Text>
                        <View className={`${CEFR_COLORS[passage.cefrLevel]?.bg ?? 'bg-surface'} rounded-md px-1.5 py-0.5`}>
                          <Text className={`${CEFR_COLORS[passage.cefrLevel]?.text ?? 'text-text-secondary'} text-xs font-sans-bold`}>
                            {passage.cefrLevel}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#7DD3FC" />
                  </Pressable>
                ))}
              </>
            )}

            {/* Library Section */}
            <Text className="text-lg font-bold text-text-primary mb-2 mt-4">Library</Text>

            {/* CEFR Level Sub-tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              <View className="flex-row gap-2">
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => {
                  const isActive = selectedCefrTab === level;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => handleCefrTabChange(level)}
                      className={`px-3 py-1.5 rounded-lg ${isActive ? 'bg-primary' : 'bg-dark-card'}`}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text className={`text-sm font-sans-semibold ${isActive ? 'text-white' : 'text-text-secondary'}`}>
                        {level}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {loadingLibrary ? (
              <Text className="text-sm text-text-secondary py-4">Loading library...</Text>
            ) : libraryBooks.length === 0 ? (
              <View className="py-4 items-center">
                <Text className="text-sm text-text-secondary mb-3">No books available for this level yet.</Text>
                <Pressable
                  className="bg-primary rounded-xl px-5 py-3 flex-row items-center"
                  onPress={async () => {
                    if (!profile?.targetLanguage) return;
                    setLoadingLibrary(true);
                    try {
                      const { error } = await supabase.functions.invoke('generate-story', {
                        body: { language: profile.targetLanguage, cefrLevel: selectedCefrTab, count: 3 },
                      });
                      if (error) throw error;
                      await loadLibraryBooks(selectedCefrTab);
                    } catch {
                      Alert.alert('Error', 'Failed to generate stories. Please try again.');
                    } finally {
                      setLoadingLibrary(false);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Generate stories for this level"
                >
                  <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                  <Text className="text-white font-sans-semibold text-sm ml-2">Generate Stories</Text>
                </Pressable>
              </View>
            ) : (
              libraryBooks.map((book) => (
                <Pressable
                  key={book.id}
                  className="bg-dark-card border-2 border-dark-border rounded-[14px] p-4 mb-2 flex-row items-center"
                  onPress={() => router.push(`/learn/reading/book/${book.id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={book.title}
                >
                  <Ionicons
                    name={book.source === 'ai_generated' ? 'sparkles' : 'book-outline'}
                    size={22}
                    color="#6366F1"
                  />
                  <View className="flex-1 ml-3">
                    <Text className="text-base font-medium text-text-primary" numberOfLines={1}>{book.title}</Text>
                    <View className="flex-row items-center gap-2 mt-1">
                      <Text className="text-sm text-text-secondary">{book.wordCount} words</Text>
                      {book.author && (
                        <Text className="text-xs text-text-secondary" numberOfLines={1}>{book.author}</Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#7DD3FC" />
                </Pressable>
              ))
            )}
          </ScrollView>
        ) : activeTab === 'writing' ? (
          /* Writing tab */
          <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
            {/* History Link */}
            <Pressable
              className="bg-primary-tint rounded-[14px] p-4 mb-3 flex-row items-center"
              onPress={() => router.push('/learn/writing/history' as any)}
              accessibilityRole="button"
              accessibilityLabel="View writing history"
            >
              <Ionicons name="time-outline" size={20} color="#6366F1" />
              <Text className="text-sm font-sans-semibold text-primary ml-2">View Writing History</Text>
              <View className="flex-1" />
              <Ionicons name="chevron-forward" size={16} color="#6366F1" />
            </Pressable>

            {!selectedCourseId ? null : !writingPrompts[selectedCourseId] ? (
              <Text className="text-sm text-text-secondary py-4">Loading prompts...</Text>
            ) : writingPrompts[selectedCourseId].length === 0 ? (
              <Text className="text-sm text-text-secondary py-4">No writing prompts available yet.</Text>
            ) : (
              writingPrompts[selectedCourseId].map((prompt) => (
                <Pressable
                  key={prompt.id}
                  className="bg-dark-card border-2 border-dark-border rounded-[14px] p-4 mb-2 flex-row items-center"
                  onPress={() => router.push(`/learn/writing/${prompt.id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={prompt.promptText}
                >
                  <Ionicons name="create-outline" size={22} color="#A855F7" />
                  <View className="flex-1 ml-3">
                    <Text className="text-base font-medium text-text-primary" numberOfLines={2}>
                      {prompt.promptText}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-1">
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
                  <Ionicons name="chevron-forward" size={18} color="#7DD3FC" />
                </Pressable>
              ))
            )}
          </ScrollView>
        ) : null}
      </View>
    </GradientBackground>
  );
}
