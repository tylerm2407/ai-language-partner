import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { WritingFeedbackResponse } from '../../lib/ai';

interface WritingFeedbackViewProps {
  feedback: WritingFeedbackResponse;
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const ratio = Math.min(score / 10, 1);
  const color = score >= 7 ? '#22C55E' : score >= 5 ? '#F59E0B' : '#EF4444';

  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.scoreValue, { color }]}>{score.toFixed(1)}</Text>
    </View>
  );
}

export function WritingFeedbackView({ feedback }: WritingFeedbackViewProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Overall Score */}
      <View style={styles.overallContainer}>
        <Text style={styles.overallLabel}>Overall Score</Text>
        <Text style={styles.overallScore}>{feedback.overallScore.toFixed(1)}</Text>
        <Text style={styles.overallMax}>/10</Text>
      </View>

      {/* Individual Scores */}
      <View style={styles.scoresSection}>
        <ScoreBar label="Grammar" score={feedback.grammarScore} />
        <ScoreBar label="Vocabulary" score={feedback.vocabScore} />
        <ScoreBar label="Coherence" score={feedback.coherenceScore} />
        <ScoreBar label="Spelling" score={feedback.spellingScore} />
      </View>

      {/* Corrections */}
      {feedback.corrections.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Corrections</Text>
          {feedback.corrections.map((c, i) => (
            <View key={i} style={styles.correctionItem}>
              <View style={styles.correctionRow}>
                <Text style={styles.correctionOriginal}>{c.original}</Text>
                <Text style={styles.arrow}> → </Text>
                <Text style={styles.correctionFixed}>{c.corrected}</Text>
              </View>
              <Text style={styles.correctionExplanation}>{c.explanation}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Suggestions */}
      {feedback.suggestions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suggestions</Text>
          {feedback.suggestions.map((s, i) => (
            <View key={i} style={styles.suggestionItem}>
              <Text style={styles.suggestionText}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Rewritten Version */}
      {feedback.rewritten && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Corrected Version</Text>
          <View style={styles.rewrittenBox}>
            <Text style={styles.rewrittenText} selectable>{feedback.rewritten}</Text>
          </View>
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
  overallContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 24,
  },
  overallLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginRight: 8,
  },
  overallScore: {
    fontSize: 48,
    fontWeight: '800',
    color: '#111827',
  },
  overallMax: {
    fontSize: 20,
    color: '#9CA3AF',
    marginLeft: 2,
  },
  scoresSection: {
    marginBottom: 24,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreLabel: {
    width: 90,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  scoreTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 12,
  },
  scoreFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreValue: {
    width: 36,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  correctionItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  correctionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 4,
  },
  correctionOriginal: {
    fontSize: 15,
    color: '#EF4444',
    textDecorationLine: 'line-through',
  },
  arrow: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  correctionFixed: {
    fontSize: 15,
    color: '#22C55E',
    fontWeight: '600',
  },
  correctionExplanation: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  suggestionItem: {
    marginBottom: 8,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
  },
  suggestionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  rewrittenBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 16,
  },
  rewrittenText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#166534',
  },
});
