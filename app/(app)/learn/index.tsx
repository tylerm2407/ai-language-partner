import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  fetchCourses,
  fetchUnits,
  fetchLessons,
  fetchReadingPassagesByCourse,
  fetchWritingPromptsByCourse,
} from '../../../lib/supabase-queries';
import { useAppStore } from '../../../stores/useAppStore';
import { LoadingScreen } from '../../../components/ui/LoadingScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Badge } from '../../../components/ui/Badge';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GradientBorderCard } from '../../../components/ui/GradientBorderCard';
import type { Course, Unit, Lesson, ReadingPassage, WritingPrompt } from '../../../types';
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
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [units, setUnits] = useState<Record<string, Unit[]>>({});
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Record<string, CourseTab>>({});
  const [readingPassages, setReadingPassages] = useState<Record<string, ReadingPassage[]>>({});
  const [writingPrompts, setWritingPrompts] = useState<Record<string, WritingPrompt[]>>({});

  useEffect(() => {
    const targetLang = profile?.targetLanguage;
    fetchCourses(targetLang).then((data) => {
      setCourses(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [profile?.targetLanguage]);

  const toggleCourse = async (courseId: string) => {
    if (expandedCourse === courseId) {
      setExpandedCourse(null);
      return;
    }
    setExpandedCourse(courseId);
    // Default to vocab tab
    if (!activeTab[courseId]) {
      setActiveTab((prev) => ({ ...prev, [courseId]: 'vocab' }));
    }
    if (!units[courseId]) {
      try {
        const courseUnits = await fetchUnits(courseId);
        setUnits((prev) => ({ ...prev, [courseId]: courseUnits }));
        const lessonResults = await Promise.all(
          courseUnits.map((unit) => fetchLessons(unit.id).then((ls) => ({ unitId: unit.id, lessons: ls })))
        );
        const lessonMap: Record<string, Lesson[]> = {};
        for (const { unitId, lessons: ls } of lessonResults) {
          lessonMap[unitId] = ls;
        }
        setLessons((prev) => ({ ...prev, ...lessonMap }));
      } catch {
        Alert.alert('Error', 'Failed to load course content. Please try again.');
      }
    }
  };

  const selectTab = async (courseId: string, tab: CourseTab) => {
    setActiveTab((prev) => ({ ...prev, [courseId]: tab }));
    // Lazy-load reading/writing data on first tab selection
    if (tab === 'reading' && !readingPassages[courseId]) {
      try {
        const passages = await fetchReadingPassagesByCourse(courseId);
        setReadingPassages((prev) => ({ ...prev, [courseId]: passages }));
      } catch {
        Alert.alert('Error', 'Failed to load reading passages.');
      }
    }
    if (tab === 'writing' && !writingPrompts[courseId]) {
      try {
        const prompts = await fetchWritingPromptsByCourse(courseId);
        setWritingPrompts((prev) => ({ ...prev, [courseId]: prompts }));
      } catch {
        Alert.alert('Error', 'Failed to load writing prompts.');
      }
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading courses..." />;
  }

  return (
    <GradientBackground>
    <SafeAreaView className="flex-1">
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
        <Text className="text-[28px] font-bold text-text-primary mb-6" accessibilityRole="header">Learn</Text>

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

        {courses.length === 0 ? (
          <EmptyState
            icon="book-outline"
            title="No courses yet"
            description="Courses will appear here once they are published to your Supabase database."
          />
        ) : (
          courses.map((course) => (
            <View key={course.id} className="mb-3">
              <GradientBorderCard>
                <Pressable
                  className="p-5 flex-row items-center"
                  onPress={() => toggleCourse(course.id)}
                  accessibilityRole="button"
                  accessibilityLabel={course.title}
                >
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-lg font-semibold text-text-primary">{course.title}</Text>
                      {course.cefrLevel && (
                        <View className={`${CEFR_COLORS[course.cefrLevel]?.bg ?? 'bg-surface'} rounded-lg px-2 py-0.5`}>
                          <Text className={`${CEFR_COLORS[course.cefrLevel]?.text ?? 'text-text-secondary'} text-xs font-sans-bold`}>
                            {CEFR_LABELS[course.cefrLevel] || course.cefrLevel}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-sm text-text-secondary">{course.description}</Text>
                  </View>
                  <Ionicons
                    name={expandedCourse === course.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#7DD3FC"
                  />
                </Pressable>
              </GradientBorderCard>

              {expandedCourse === course.id && (
                <View className="mt-2">
                  {/* Tab selector */}
                  <View className="flex-row ml-4 mb-3 gap-2">
                    {TAB_CONFIG.map((tab) => {
                      const isActive = (activeTab[course.id] ?? 'vocab') === tab.key;
                      return (
                        <Pressable
                          key={tab.key}
                          onPress={() => selectTab(course.id, tab.key)}
                          className={`flex-row items-center px-3 py-2 rounded-xl ${isActive ? 'bg-primary' : 'bg-dark-card'}`}
                          accessibilityRole="tab"
                          accessibilityLabel={tab.label}
                          accessibilityState={{ selected: isActive }}
                        >
                          <Ionicons name={tab.icon} size={16} color={isActive ? '#FFFFFF' : '#94A3B8'} />
                          <Text className={`text-sm font-sans-semibold ml-1.5 ${isActive ? 'text-white' : 'text-text-secondary'}`}>
                            {tab.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Vocab tab (existing units/lessons tree) */}
                  {(activeTab[course.id] ?? 'vocab') === 'vocab' && units[course.id]?.map((unit) => (
                    <View key={unit.id} className="ml-4 mt-2">
                      <Text className="text-base font-semibold text-text-primary mb-2">{unit.title}</Text>
                      {lessons[unit.id]?.map((lesson) => (
                        <Pressable
                          key={lesson.id}
                          className="bg-dark-card border-2 border-dark-border rounded-[14px] p-4 mb-2 flex-row items-center"
                          onPress={() => router.push(`/learn/${lesson.id}` as any)}
                          accessibilityRole="button"
                          accessibilityLabel={lesson.title}
                        >
                          <View className="flex-1">
                            <Text className="text-base font-medium text-text-primary">{lesson.title}</Text>
                            <Text className="text-sm text-text-secondary">{lesson.estimatedMinutes} min · {lesson.xpReward} XP</Text>
                          </View>
                          <Ionicons name="play-circle" size={24} color="#A855F7" />
                        </Pressable>
                      ))}
                    </View>
                  ))}

                  {/* Reading tab */}
                  {(activeTab[course.id]) === 'reading' && (
                    <View className="ml-4">
                      {!readingPassages[course.id] ? (
                        <Text className="text-sm text-text-secondary py-4">Loading passages...</Text>
                      ) : readingPassages[course.id].length === 0 ? (
                        <Text className="text-sm text-text-secondary py-4">No reading passages available yet.</Text>
                      ) : (
                        readingPassages[course.id].map((passage) => (
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
                        ))
                      )}
                    </View>
                  )}

                  {/* Writing tab */}
                  {(activeTab[course.id]) === 'writing' && (
                    <View className="ml-4">
                      {!writingPrompts[course.id] ? (
                        <Text className="text-sm text-text-secondary py-4">Loading prompts...</Text>
                      ) : writingPrompts[course.id].length === 0 ? (
                        <Text className="text-sm text-text-secondary py-4">No writing prompts available yet.</Text>
                      ) : (
                        writingPrompts[course.id].map((prompt) => (
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
                                  {prompt.minWords ?? '?'}–{prompt.maxWords ?? '?'} words
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
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
    </GradientBackground>
  );
}
