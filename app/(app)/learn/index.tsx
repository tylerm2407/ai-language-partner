import { useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useProfile } from '../../../hooks/useProfile';
import { useCourses, useUnits, useLessons } from '../../../hooks/useCoursesAndLessons';
import type { Course, Unit, Lesson } from '../../../types';

export default function LearnScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const { courses, isLoading: coursesLoading } = useCourses(profile?.targetLanguage);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  const { units, isLoading: unitsLoading } = useUnits(selectedCourse?.id ?? null);
  const { lessons, isLoading: lessonsLoading } = useLessons(selectedUnit?.id ?? null);

  const isLoading = coursesLoading;

  // Back navigation within the learn screen
  const handleBack = () => {
    if (selectedUnit) {
      setSelectedUnit(null);
    } else if (selectedCourse) {
      setSelectedCourse(null);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  // ─── Lesson List (within a unit) ──────────────────────────────

  if (selectedUnit) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ padding: 20 }}>
          <Pressable onPress={handleBack} style={{ marginBottom: 12 }} accessibilityRole="button">
            <Text style={{ fontSize: 16, color: '#6366F1' }}>Back</Text>
          </Pressable>
          <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 4 }} accessibilityRole="header">
            {selectedUnit.title}
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
            {selectedUnit.description}
          </Text>
        </View>

        {lessonsLoading ? (
          <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 24 }} />
        ) : lessons.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 32 }}>
            <Text style={{ fontSize: 16, color: '#999' }}>No lessons in this unit yet.</Text>
          </View>
        ) : (
          <FlatList
            data={lessons}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => router.push(`/(app)/learn/${item.id}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F9FAFB',
                  padding: 16,
                  borderRadius: 14,
                  marginBottom: 10,
                }}
                accessibilityRole="button"
                accessibilityLabel={`Lesson ${index + 1}: ${item.title}`}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: '#6366F1',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 14,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                    {index + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
                  <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                    {item.estimatedMinutes} min  |  +{item.xpReward} XP
                  </Text>
                </View>
                <Text style={{ fontSize: 20, color: '#C7D2FE' }}>{'>'}</Text>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // ─── Unit List (within a course) ──────────────────────────────

  if (selectedCourse) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ padding: 20 }}>
          <Pressable onPress={handleBack} style={{ marginBottom: 12 }} accessibilityRole="button">
            <Text style={{ fontSize: 16, color: '#6366F1' }}>Back</Text>
          </Pressable>
          <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 4 }} accessibilityRole="header">
            {selectedCourse.title}
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
            {selectedCourse.description}
          </Text>
        </View>

        {unitsLoading ? (
          <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 24 }} />
        ) : units.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 32 }}>
            <Text style={{ fontSize: 16, color: '#999' }}>No units in this course yet.</Text>
          </View>
        ) : (
          <FlatList
            data={units}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => setSelectedUnit(item)}
                style={{
                  backgroundColor: '#F9FAFB',
                  padding: 20,
                  borderRadius: 16,
                  marginBottom: 12,
                }}
                accessibilityRole="button"
                accessibilityLabel={`Unit ${index + 1}: ${item.title}`}
              >
                <Text style={{ fontSize: 13, color: '#6366F1', fontWeight: '600', marginBottom: 4 }}>
                  UNIT {index + 1}
                </Text>
                <Text style={{ fontSize: 18, fontWeight: '600' }}>{item.title}</Text>
                <Text style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
                  {item.description}
                </Text>
                <Text style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                  {item.totalLessons} lesson{item.totalLessons !== 1 ? 's' : ''}
                </Text>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // ─── Course List ──────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 20 }} accessibilityRole="header">
          Learn
        </Text>
      </View>

      {courses.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 48 }}>
          <Text style={{ fontSize: 18, color: '#666', textAlign: 'center' }}>
            No courses available yet.
          </Text>
          <Text style={{ fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center' }}>
            Courses will appear here once content is loaded.
          </Text>
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedCourse(item)}
              style={{
                backgroundColor: '#F9FAFB',
                padding: 20,
                borderRadius: 16,
                marginBottom: 12,
              }}
              accessibilityRole="button"
              accessibilityLabel={`Course: ${item.title}`}
            >
              <Text style={{ fontSize: 18, fontWeight: '600' }}>{item.title}</Text>
              <Text style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
                {item.description}
              </Text>
              <Text style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                {item.sourceLanguage.toUpperCase()} → {item.targetLanguage.toUpperCase()}  |  {item.totalUnits} unit{item.totalUnits !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
