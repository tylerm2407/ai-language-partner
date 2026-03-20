import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';

interface ReadingChatSheetProps {
  loading: boolean;
  result: Record<string, unknown> | null;
  error: string | null;
  onAction: (action: 'summarize' | 'define' | 'comprehension_questions') => void;
  isAllowed: boolean;
}

export function ReadingChatSheet({ loading, result, error, onAction, isAllowed }: ReadingChatSheetProps) {
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleAction = (action: 'summarize' | 'define' | 'comprehension_questions') => {
    setActiveAction(action);
    onAction(action);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ask AI About This Reading</Text>

      {!isAllowed && (
        <View style={styles.limitWarning}>
          <Text style={styles.limitText}>AI quota reached. Upgrade to continue.</Text>
        </View>
      )}

      <View style={styles.actions}>
        <ActionButton
          label="Summarize"
          active={activeAction === 'summarize'}
          disabled={loading || !isAllowed}
          onPress={() => handleAction('summarize')}
        />
        <ActionButton
          label="Key Vocabulary"
          active={activeAction === 'define'}
          disabled={loading || !isAllowed}
          onPress={() => handleAction('define')}
        />
        <ActionButton
          label="Comprehension Qs"
          active={activeAction === 'comprehension_questions'}
          disabled={loading || !isAllowed}
          onPress={() => handleAction('comprehension_questions')}
        />
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6366F1" />
          <Text style={styles.loadingText}>Thinking...</Text>
        </View>
      )}

      {error && (
        <Text style={styles.error}>{error}</Text>
      )}

      {result && !loading && (
        <ScrollView style={styles.resultContainer}>
          {/* Summary result */}
          {result.summary && (
            <Text style={styles.resultText}>{result.summary as string}</Text>
          )}

          {/* Definitions result */}
          {Array.isArray(result.definitions) && (result.definitions as { word: string; definition: string; example: string }[]).map((def, i) => (
            <View key={i} style={styles.definitionItem}>
              <Text style={styles.defWord}>{def.word}</Text>
              <Text style={styles.defMeaning}>{def.definition}</Text>
              {def.example && <Text style={styles.defExample}>{def.example}</Text>}
            </View>
          ))}

          {/* Comprehension questions result */}
          {Array.isArray(result.questions) && (result.questions as { question: string; answer: string }[]).map((q, i) => (
            <View key={i} style={styles.questionItem}>
              <Text style={styles.questionText}>{i + 1}. {q.question}</Text>
              <Text style={styles.answerText}>{q.answer}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function ActionButton({ label, active, disabled, onPress }: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.actionButton, active && styles.actionButtonActive, disabled && styles.actionButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.actionText, active && styles.actionTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 200,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  limitWarning: {
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  limitText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  actionButtonActive: {
    backgroundColor: '#6366F1',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  actionTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  error: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  resultContainer: {
    maxHeight: 300,
  },
  resultText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#1F2937',
  },
  definitionItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  defWord: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 2,
  },
  defMeaning: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  defExample: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  questionItem: {
    marginBottom: 16,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  answerText: {
    fontSize: 14,
    color: '#6B7280',
    paddingLeft: 16,
  },
});
