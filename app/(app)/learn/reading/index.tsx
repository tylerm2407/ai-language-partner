import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { CEFRLevel, ReadingMaterial } from '../../../../types';
import { useReadingLibrary } from '../../../../hooks/useReadingLibrary';
import { useProfile } from '../../../../hooks/useProfile';
import { useCourses } from '../../../../hooks/useCoursesAndLessons';
import { ReadingCard } from '../../../../components/reading/ReadingCard';
import { trackEvent } from '../../../../lib/analytics';

const ALL_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function ReadingLibraryScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel | undefined>(undefined);

  const targetLanguage = profile?.targetLanguage;
  const { courses } = useCourses(targetLanguage);
  const courseId = courses[0]?.id ?? '';

  const { readings, loading, error, loadReadings } = useReadingLibrary(courseId);

  useEffect(() => {
    if (courseId) {
      loadReadings({ level: selectedLevel });
    }
  }, [courseId, selectedLevel, loadReadings]);

  const handleReadingPress = (reading: ReadingMaterial) => {
    trackEvent('reading_opened', { readingId: reading.id, level: reading.level });
    router.push(`/learn/reading/${reading.id}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Reading Library</Text>
        <Text style={styles.subtitle}>Practice reading at your level</Text>
      </View>

      {/* Level Filter */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, !selectedLevel && styles.filterChipActive]}
          onPress={() => setSelectedLevel(undefined)}
          accessibilityRole="button"
          accessibilityLabel="All levels"
        >
          <Text style={[styles.filterText, !selectedLevel && styles.filterTextActive]}>All</Text>
        </Pressable>
        {ALL_LEVELS.map((level) => (
          <Pressable
            key={level}
            style={[styles.filterChip, selectedLevel === level && styles.filterChipActive]}
            onPress={() => setSelectedLevel(level)}
            accessibilityRole="button"
            accessibilityLabel={`Filter by level ${level}`}
          >
            <Text style={[styles.filterText, selectedLevel === level && styles.filterTextActive]}>
              {level}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Reading List */}
      {loading && readings.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading readings...</Text>
        </View>
      ) : (
        <FlatList
          data={readings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ReadingCard reading={item} onPress={() => handleReadingPress(item)} />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {error ? error : 'No readings available yet for this level.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#9CA3AF',
    marginTop: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    minHeight: 44,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: '#6366F1',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  empty: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
