import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { useSpeakingHistory } from '../../../hooks/useSpeakingPractice';

export default function PronunciationHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { attempts, loading, loadHistory } = useSpeakingHistory(userId);

  useEffect(() => {
    if (userId) loadHistory();
  }, [userId, loadHistory]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Pronunciation History</Text>
        <Text style={styles.subtitle}>Your past pronunciation scores</Text>
      </View>

      <FlatList
        data={attempts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.scoresRow}>
                {item.pronunciationScore != null && (
                  <ScoreBubble label="Pron" score={item.pronunciationScore} />
                )}
                {item.fluencyScore != null && (
                  <ScoreBubble label="Flu" score={item.fluencyScore} />
                )}
                {item.rhythmScore != null && (
                  <ScoreBubble label="Rhythm" score={item.rhythmScore} />
                )}
              </View>
              {item.overallScore != null && (
                <Text style={[
                  styles.overallScore,
                  { color: item.overallScore >= 7 ? '#22C55E' : item.overallScore >= 5 ? '#F59E0B' : '#EF4444' },
                ]}>
                  {item.overallScore.toFixed(1)}
                </Text>
              )}
            </View>
            {item.transcript && (
              <Text style={styles.transcript} numberOfLines={2}>"{item.transcript}"</Text>
            )}
            {item.targetTextRef && (
              <Text style={styles.targetRef} numberOfLines={1}>Target: {item.targetTextRef}</Text>
            )}
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading...' : 'No pronunciation attempts yet.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function ScoreBubble({ label, score }: { label: string; score: number }) {
  const color = score >= 7 ? '#22C55E' : score >= 5 ? '#F59E0B' : '#EF4444';
  return (
    <View style={[styles.scoreBubble, { borderColor: color }]}>
      <Text style={[styles.scoreBubbleValue, { color }]}>{score.toFixed(1)}</Text>
      <Text style={styles.scoreBubbleLabel}>{label}</Text>
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
    marginBottom: 10,
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 8,
  },
  overallScore: {
    fontSize: 22,
    fontWeight: '800',
  },
  scoreBubble: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  scoreBubbleValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  scoreBubbleLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  transcript: {
    fontSize: 14,
    color: '#4B5563',
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 4,
  },
  targetRef: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
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
