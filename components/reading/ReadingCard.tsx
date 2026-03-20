import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { ReadingMaterial } from '../../types';
import { CEFRBadge } from '../ui/CEFRBadge';

interface ReadingCardProps {
  reading: ReadingMaterial;
  onPress: () => void;
}

export function ReadingCard({ reading, onPress }: ReadingCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Read: ${reading.title}`}>
      <View style={styles.header}>
        <CEFRBadge level={reading.level} />
        {reading.difficultyScore != null && (
          <Text style={styles.difficulty}>
            {reading.difficultyScore.toFixed(1)}/10
          </Text>
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>{reading.title}</Text>
      {reading.author && (
        <Text style={styles.author}>{reading.author}</Text>
      )}
      {reading.summary && (
        <Text style={styles.summary} numberOfLines={2}>{reading.summary}</Text>
      )}
      <View style={styles.footer}>
        {reading.wordCount != null && (
          <Text style={styles.meta}>{reading.wordCount} words</Text>
        )}
        {reading.isPublicDomain && (
          <Text style={styles.publicDomain}>Public Domain</Text>
        )}
      </View>
      {reading.tags.length > 0 && (
        <View style={styles.tags}>
          {reading.tags.slice(0, 3).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  difficulty: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  author: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  summary: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  meta: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  publicDomain: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
    color: '#6B7280',
  },
});
