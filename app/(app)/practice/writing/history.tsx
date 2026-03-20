import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../../hooks/useAuth';
import { useWritingHistory } from '../../../../hooks/useWritingPractice';
import { CEFRBadge } from '../../../../components/ui/CEFRBadge';

export default function WritingHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { submissions, loading, loadHistory } = useWritingHistory(userId);

  useEffect(() => {
    if (userId) loadHistory();
  }, [userId, loadHistory]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Writing History</Text>
        <Text style={styles.subtitle}>Your past writing submissions and scores</Text>
      </View>

      <FlatList
        data={submissions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              {item.level && <CEFRBadge level={item.level} />}
              {item.overallScore != null && (
                <Text style={[
                  styles.score,
                  { color: item.overallScore >= 7 ? '#22C55E' : item.overallScore >= 5 ? '#F59E0B' : '#EF4444' },
                ]}>
                  {item.overallScore.toFixed(1)}/10
                </Text>
              )}
            </View>
            <Text style={styles.cardText} numberOfLines={3}>{item.text}</Text>
            <View style={styles.cardScores}>
              {item.grammarScore != null && (
                <ScoreTag label="Grammar" score={item.grammarScore} />
              )}
              {item.vocabScore != null && (
                <ScoreTag label="Vocab" score={item.vocabScore} />
              )}
              {item.coherenceScore != null && (
                <ScoreTag label="Coherence" score={item.coherenceScore} />
              )}
              {item.spellingScore != null && (
                <ScoreTag label="Spelling" score={item.spellingScore} />
              )}
            </View>
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading...' : 'No writing submissions yet. Start practicing!'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function ScoreTag({ label, score }: { label: string; score: number }) {
  const color = score >= 7 ? '#22C55E' : score >= 5 ? '#F59E0B' : '#EF4444';
  return (
    <View style={styles.scoreTag}>
      <Text style={styles.scoreTagLabel}>{label}</Text>
      <Text style={[styles.scoreTagValue, { color }]}>{score.toFixed(1)}</Text>
    </View>
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
    paddingBottom: 12,
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
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  score: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 10,
  },
  cardScores: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  scoreTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scoreTagLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  scoreTagValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
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
