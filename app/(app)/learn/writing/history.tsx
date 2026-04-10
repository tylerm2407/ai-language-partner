import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../hooks/useAuth';
import { fetchAllUserWritingSubmissions } from '../../../../lib/supabase-queries';
import type { WritingSubmission } from '../../../../types';
import { GradientBackground } from '../../../../components/ui/GradientBackground';

const CEFR_COLORS: Record<string, { bg: string; text: string }> = {
  A1: { bg: '#DCFCE7', text: '#22C55E' },
  A2: { bg: '#E0E7FF', text: '#6366F1' },
  B1: { bg: '#FEF9C3', text: '#CA8A04' },
  B2: { bg: '#FEE2E2', text: '#EF4444' },
  C1: { bg: '#E0E7FF', text: '#6366F1' },
  C2: { bg: '#F3F4F6', text: '#666666' },
};

export default function WritingHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<WritingSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchAllUserWritingSubmissions(user.id)
      .then(setSubmissions)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user]);

  // Group by prompt
  const groupedByPrompt = submissions.reduce<Record<string, WritingSubmission[]>>((acc, sub) => {
    if (!acc[sub.promptId]) acc[sub.promptId] = [];
    acc[sub.promptId].push(sub);
    return acc;
  }, {});

  const promptEntries = Object.entries(groupedByPrompt).map(([promptId, subs]) => {
    const sorted = [...subs].sort((a, b) => a.attemptNumber - b.attemptNumber);
    const bestScore = Math.max(...subs.map((s) => s.overallScore ?? 0));
    const latestDate = subs.reduce((latest, s) =>
      s.submittedAt > latest ? s.submittedAt : latest, subs[0].submittedAt);
    return { promptId, submissions: sorted, bestScore, latestDate, attemptCount: subs.length };
  }).sort((a, b) => b.latestDate.localeCompare(a.latestDate));

  if (isLoading) {
    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6366F1" />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
    <SafeAreaView style={{ flex: 1 }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color="#9CA3AF" />
        </Pressable>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginLeft: 8 }} accessibilityRole="header">
          Writing History
        </Text>
      </View>

      {promptEntries.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="create-outline" size={48} color="#D1D5DB" />
          <Text style={{ fontSize: 16, color: '#9CA3AF', marginTop: 12, textAlign: 'center' }}>
            No writing submissions yet. Complete a writing exercise to see your history here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {promptEntries.map((entry) => {
            const scoreColor = entry.bestScore >= 0.8 ? '#22C55E' : entry.bestScore >= 0.6 ? '#CA8A04' : '#EF4444';
            const scoreBg = entry.bestScore >= 0.8 ? '#DCFCE7' : entry.bestScore >= 0.6 ? '#FEF9C3' : '#FEE2E2';
            const displayScore = Math.round(entry.bestScore * 100);

            return (
              <Pressable
                key={entry.promptId}
                style={{
                  backgroundColor: '#151921', borderRadius: 14, padding: 16, marginBottom: 10,
                }}
                onPress={() => router.push(`/learn/writing/${entry.promptId}` as any)}
                accessibilityRole="button"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, color: '#FFFFFF', fontWeight: '500' }} numberOfLines={2}>
                      {entry.submissions[0].submissionText.slice(0, 80)}...
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                      <Text style={{ fontSize: 13, color: '#999' }}>
                        {entry.attemptCount} attempt{entry.attemptCount !== 1 ? 's' : ''}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#999' }}>
                        {new Date(entry.latestDate).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  {/* Best Score */}
                  <View style={{
                    width: 50, height: 50, borderRadius: 25,
                    backgroundColor: scoreBg, justifyContent: 'center', alignItems: 'center', marginLeft: 12,
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: scoreColor }}>{displayScore}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
    </GradientBackground>
  );
}
