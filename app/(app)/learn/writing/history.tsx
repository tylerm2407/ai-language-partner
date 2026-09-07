import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSafeBack } from '../../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../hooks/useAuth';
import { fetchAllUserWritingSubmissions } from '../../../../lib/supabase-queries';
import type { WritingSubmissionWithPrompt } from '../../../../lib/supabase-queries';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to.
import { useUi2Theme } from '../../../../hooks/useUi2Theme';
import { SlabCard } from '../../../../components/ui2/SlabCard';
import { Heading, Body, Caption } from '../../../../components/ui2/Ui2Text';
import { Ui2InlineError } from '../../../../components/ui2/Ui2InlineError';
import { loadErrorCopy, type ErrorCopy } from '../../../../lib/error-copy';

export default function WritingHistoryScreen() {
  const { c, shape } = useUi2Theme();
  const router = useRouter();
  const goBack = useSafeBack('/(app)');
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<WritingSubmissionWithPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ErrorCopy | null>(null);

  // The catch used to be `() => {}`, so an outage rendered "No writing
  // submissions yet" — telling a learner their work is gone (CLAUDE.md §5).
  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      setSubmissions(await fetchAllUserWritingSubmissions(user.id));
    } catch (err) {
      console.error('Failed to load writing history:', err);
      setError(loadErrorCopy(err, 'your writing history'));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Group by prompt
  const groupedByPrompt = submissions.reduce<Record<string, WritingSubmissionWithPrompt[]>>((acc, sub) => {
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
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={c.primary} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
    <SafeAreaView style={{ flex: 1 }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => goBack()} hitSlop={8} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={c.idle} />
        </Pressable>
        <Heading level={2} style={{ marginLeft: 8 }} accessibilityRole="header">
          Writing History
        </Heading>
      </View>

      {error ? (
        <Ui2InlineError copy={error} onRetry={load} />
      ) : promptEntries.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Ionicons name="create-outline" size={48} color={c.idle} />
          <Body tone="tertiary" style={{ marginTop: 12, textAlign: 'center' }}>
            No writing submissions yet. Complete a writing exercise to see your history here.
          </Body>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {promptEntries.map((entry) => {
            // The disc's FILL carries the band; the number stays `ink`. The hue
            // tokens do not clear AA on their own tints in the light scheme, and
            // a two-digit score is not a colour-only cue to begin with.
            const scoreBorder = entry.bestScore >= 0.8 ? c.greenBorder : entry.bestScore >= 0.6 ? c.yellowBorder : c.pinkTint;
            const scoreBg = entry.bestScore >= 0.8 ? c.greenTint : entry.bestScore >= 0.6 ? c.yellowTint : c.pinkTint;
            const displayScore = Math.round(entry.bestScore * 100);

            return (
              <SlabCard key={entry.promptId} style={{ marginBottom: 10, padding: 0 }}>
                <Pressable
                  style={{ padding: 16 }}
                  onPress={() => router.push(`/learn/writing/${entry.promptId}` as any)}
                  accessibilityRole="button"
                >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Body weight="medium" numberOfLines={2}>
                      {entry.submissions[0].promptTitle ?? `${entry.submissions[0].submissionText.slice(0, 80)}...`}
                    </Body>
                    {entry.submissions[0].promptTitle != null && (
                      <Caption tone="secondary" style={{ marginTop: 2 }} numberOfLines={1}>
                        {entry.submissions[0].submissionText.slice(0, 80)}
                      </Caption>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                      <Caption tone="tertiary">
                        {entry.attemptCount} attempt{entry.attemptCount !== 1 ? 's' : ''}
                      </Caption>
                      <Caption tone="tertiary">
                        {new Date(entry.latestDate).toLocaleDateString()}
                      </Caption>
                    </View>
                  </View>
                  {/* Best Score */}
                  <View style={{
                    width: 50, height: 50, borderRadius: 25,
                    backgroundColor: scoreBg, borderColor: scoreBorder, borderWidth: shape.border,
                    justifyContent: 'center', alignItems: 'center', marginLeft: 12,
                  }}>
                    <Body weight="bold">{displayScore}</Body>
                  </View>
                </View>
                </Pressable>
              </SlabCard>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
    </View>
  );
}
