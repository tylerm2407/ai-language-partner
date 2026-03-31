import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { fetchCourses, fetchUnits, fetchLessons } from '../../../lib/supabase-queries';
import { useAppStore } from '../../../stores/useAppStore';
import { LoadingScreen } from '../../../components/ui/LoadingScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Badge } from '../../../components/ui/Badge';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GradientBorderCard } from '../../../components/ui/GradientBorderCard';
import type { Course, Unit, Lesson } from '../../../types';
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

export default function LearnScreen() {
  const router = useRouter();
  const { reviewCount, profile } = useAppStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [units, setUnits] = useState<Record<string, Unit[]>>({});
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [loading, setLoading] = useState(true);

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

              {expandedCourse === course.id && units[course.id]?.map((unit) => (
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
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
    </GradientBackground>
  );
}
