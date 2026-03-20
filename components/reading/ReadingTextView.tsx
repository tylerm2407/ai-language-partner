import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import type { ReadingMaterial } from '../../types';
import { CEFRBadge } from '../ui/CEFRBadge';

interface ReadingTextViewProps {
  reading: ReadingMaterial;
}

export function ReadingTextView({ reading }: ReadingTextViewProps) {
  const [showSummary, setShowSummary] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <CEFRBadge level={reading.level} size="medium" />
        {reading.difficultyScore != null && (
          <Text style={styles.difficulty}>Difficulty: {reading.difficultyScore.toFixed(1)}/10</Text>
        )}
      </View>

      <Text style={styles.title}>{reading.title}</Text>

      {reading.author && (
        <Text style={styles.author}>by {reading.author}</Text>
      )}

      {reading.wordCount != null && (
        <Text style={styles.wordCount}>{reading.wordCount} words</Text>
      )}

      {reading.summary && (
        <Pressable
          style={styles.summaryToggle}
          onPress={() => setShowSummary(!showSummary)}
          accessibilityRole="button"
          accessibilityLabel={showSummary ? 'Hide summary' : 'Show summary'}
        >
          <Text style={styles.summaryToggleText}>
            {showSummary ? 'Hide Summary' : 'Show Summary'}
          </Text>
        </Pressable>
      )}

      {showSummary && reading.summary && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{reading.summary}</Text>
        </View>
      )}

      <View style={styles.textContainer}>
        <Text style={styles.readingText} selectable>
          {reading.text}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  difficulty: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  author: {
    fontSize: 15,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  wordCount: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  summaryToggle: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  summaryToggleText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  summaryBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    color: '#4338CA',
    lineHeight: 20,
  },
  textContainer: {
    marginTop: 8,
  },
  readingText: {
    fontSize: 18,
    lineHeight: 30,
    color: '#1F2937',
    letterSpacing: 0.2,
  },
});
