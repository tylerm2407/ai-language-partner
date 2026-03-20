import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

interface WritingEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  minWords?: number | null;
  maxWords?: number | null;
  placeholder?: string;
  editable?: boolean;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function WritingEditor({
  value,
  onChangeText,
  minWords,
  maxWords,
  placeholder = 'Start writing...',
  editable = true,
}: WritingEditorProps) {
  const wordCount = countWords(value);
  const isUnderMin = minWords != null && wordCount < minWords;
  const isOverMax = maxWords != null && wordCount > maxWords;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        multiline
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        editable={editable}
        textAlignVertical="top"
        accessibilityLabel="Writing area"
      />
      <View style={styles.footer}>
        <Text style={[styles.wordCount, isUnderMin && styles.wordCountWarning, isOverMax && styles.wordCountError]}>
          {wordCount} words
        </Text>
        {(minWords != null || maxWords != null) && (
          <Text style={styles.range}>
            {minWords != null && maxWords != null
              ? `Target: ${minWords}–${maxWords}`
              : minWords != null
              ? `Min: ${minWords}`
              : `Max: ${maxWords}`}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 26,
    color: '#1F2937',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 200,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  wordCount: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  wordCountWarning: {
    color: '#F59E0B',
  },
  wordCountError: {
    color: '#EF4444',
  },
  range: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});
