import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { PronunciationScoreResponse } from '../../lib/ai';

interface PronunciationScoreViewProps {
  result: PronunciationScoreResponse;
}

function CircleScore({ label, score }: { label: string; score: number }) {
  const color = score >= 7 ? '#22C55E' : score >= 5 ? '#F59E0B' : '#EF4444';

  return (
    <View style={styles.circleContainer}>
      <View style={[styles.circle, { borderColor: color }]}>
        <Text style={[styles.circleScore, { color }]}>{score.toFixed(1)}</Text>
      </View>
      <Text style={styles.circleLabel}>{label}</Text>
    </View>
  );
}

export function PronunciationScoreView({ result }: PronunciationScoreViewProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Score Circles */}
      <View style={styles.scoresRow}>
        <CircleScore label="Pronunciation" score={result.pronunciationScore} />
        <CircleScore label="Fluency" score={result.fluencyScore} />
        <CircleScore label="Rhythm" score={result.rhythmScore} />
      </View>

      {/* Overall */}
      <View style={styles.overallContainer}>
        <Text style={styles.overallLabel}>Overall</Text>
        <Text style={styles.overallScore}>{result.overallScore.toFixed(1)}/10</Text>
      </View>

      {/* Feedback */}
      {result.feedback && (
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackText}>{result.feedback}</Text>
        </View>
      )}

      {/* Transcription */}
      {result.transcription && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What we heard</Text>
          <Text style={styles.transcriptionText} selectable>{result.transcription}</Text>
        </View>
      )}

      {/* Word Errors */}
      {result.wordErrors && result.wordErrors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Words to Practice</Text>
          {result.wordErrors.map((err, i) => (
            <View key={i} style={styles.errorItem}>
              <Text style={styles.errorWord}>{err.word}</Text>
              <Text style={styles.errorIssue}>{err.issue}</Text>
              <Text style={styles.errorSuggestion}>{err.suggestion}</Text>
            </View>
          ))}
        </View>
      )}
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
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  circleContainer: {
    alignItems: 'center',
  },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  circleScore: {
    fontSize: 22,
    fontWeight: '800',
  },
  circleLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  overallContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  overallLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  overallScore: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  feedbackBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  feedbackText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#3730A3',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  transcriptionText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#374151',
    fontStyle: 'italic',
  },
  errorItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  errorWord: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 2,
  },
  errorIssue: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  errorSuggestion: {
    fontSize: 13,
    color: '#059669',
  },
});
