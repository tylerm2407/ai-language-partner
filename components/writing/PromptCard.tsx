import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { WritingPrompt } from '../../types';
import { CEFRBadge } from '../ui/CEFRBadge';

const TYPE_LABELS: Record<string, string> = {
  phrase: 'Phrase',
  sentence: 'Sentence',
  paragraph: 'Paragraph',
  letter: 'Letter',
  essay: 'Essay',
};

interface PromptCardProps {
  prompt: WritingPrompt;
  onPress: () => void;
}

export function PromptCard({ prompt, onPress }: PromptCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Writing prompt: ${prompt.title}`}>
      <View style={styles.header}>
        <CEFRBadge level={prompt.level} />
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{TYPE_LABELS[prompt.type] ?? prompt.type}</Text>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={2}>{prompt.title}</Text>
      <Text style={styles.promptPreview} numberOfLines={2}>{prompt.promptText}</Text>
      <View style={styles.footer}>
        {prompt.minWords != null && prompt.maxWords != null && (
          <Text style={styles.wordRange}>{prompt.minWords}–{prompt.maxWords} words</Text>
        )}
      </View>
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
    gap: 8,
    marginBottom: 8,
  },
  typeBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  promptPreview: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
  },
  wordRange: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
