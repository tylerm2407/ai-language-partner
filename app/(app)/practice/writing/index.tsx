import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { CEFRLevel, WritingPrompt, WritingPromptType } from '../../../../types';
import { useWritingPrompts } from '../../../../hooks/useWritingPractice';
import { useProfile } from '../../../../hooks/useProfile';
import { useCourses } from '../../../../hooks/useCoursesAndLessons';
import { PromptCard } from '../../../../components/writing/PromptCard';
import { trackEvent } from '../../../../lib/analytics';

const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const TYPES: { key: WritingPromptType; label: string }[] = [
  { key: 'phrase', label: 'Phrase' },
  { key: 'sentence', label: 'Sentence' },
  { key: 'paragraph', label: 'Paragraph' },
  { key: 'letter', label: 'Letter' },
  { key: 'essay', label: 'Essay' },
];

export default function WritingPracticeScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<WritingPromptType | undefined>(undefined);

  const targetLanguage = profile?.targetLanguage;
  const { courses } = useCourses(targetLanguage);
  const courseId = courses[0]?.id ?? '';
  const { prompts, loading, error, loadPrompts } = useWritingPrompts(courseId);

  useEffect(() => {
    if (courseId) {
      loadPrompts({ level: selectedLevel, type: selectedType });
    }
  }, [courseId, selectedLevel, selectedType, loadPrompts]);

  const handlePromptPress = (prompt: WritingPrompt) => {
    trackEvent('writing_prompt_selected', { promptId: prompt.id, level: prompt.level, type: prompt.type });
    router.push(`/practice/writing/${prompt.id}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/practice/writing/history')}
            style={styles.historyButton}
            accessibilityRole="button"
            accessibilityLabel="View writing history"
          >
            <Text style={styles.historyText}>History</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Writing Practice</Text>
        <Text style={styles.subtitle}>Improve your writing skills with AI feedback</Text>
      </View>

      {/* Level Filter */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.chip, !selectedLevel && styles.chipActive]}
          onPress={() => setSelectedLevel(undefined)}
          accessibilityRole="button"
        >
          <Text style={[styles.chipText, !selectedLevel && styles.chipTextActive]}>All</Text>
        </Pressable>
        {LEVELS.map((level) => (
          <Pressable
            key={level}
            style={[styles.chip, selectedLevel === level && styles.chipActive]}
            onPress={() => setSelectedLevel(level)}
            accessibilityRole="button"
          >
            <Text style={[styles.chipText, selectedLevel === level && styles.chipTextActive]}>{level}</Text>
          </Pressable>
        ))}
      </View>

      {/* Type Filter */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.chip, !selectedType && styles.chipActive]}
          onPress={() => setSelectedType(undefined)}
          accessibilityRole="button"
        >
          <Text style={[styles.chipText, !selectedType && styles.chipTextActive]}>All Types</Text>
        </Pressable>
        {TYPES.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.chip, selectedType === t.key && styles.chipActive]}
            onPress={() => setSelectedType(t.key)}
            accessibilityRole="button"
          >
            <Text style={[styles.chipText, selectedType === t.key && styles.chipTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Prompts List */}
      {loading && prompts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading prompts...</Text>
        </View>
      ) : (
        <FlatList
          data={prompts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PromptCard prompt={item} onPress={() => handlePromptPress(item)} />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {error ? error : 'No writing prompts available for this level.'}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  historyButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  historyText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
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
    paddingVertical: 4,
    gap: 6,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#6366F1',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 15,
    color: '#9CA3AF',
    marginTop: 12,
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
