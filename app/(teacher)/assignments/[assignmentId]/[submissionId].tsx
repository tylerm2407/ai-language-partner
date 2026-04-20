import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../../components/ui/GlassSurface';
import { GradientButton } from '../../../../components/ui/GradientButton';
import StatusBadge from '../../../../components/school/StatusBadge';
import TranscriptViewer from '../../../../components/school/TranscriptViewer';
import { fetchSubmissionDetail, fetchSubmissionTranscript, gradeSubmission } from '../../../../lib/supabase-queries';
import type { AssignmentSubmission, ConversationGrade, ConversationMessage } from '../../../../types';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function RubricRow({ label, score }: { label: string; score: number }) {
  return (
    <View className="flex-row items-center justify-between mb-2">
      <Text
        className="text-sm text-text-secondary"
        style={{ fontFamily: 'Inter_500Medium' }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: score >= 80 ? '#22C55E' : score >= 60 ? '#F59E0B' : '#EF4444',
          fontSize: 14,
          fontFamily: 'Inter_700Bold',
        }}
      >
        {score}%
      </Text>
    </View>
  );
}

export default function GradingScreen() {
  const router = useRouter();
  const { assignmentId, submissionId } = useLocalSearchParams<{
    assignmentId: string;
    submissionId: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [transcript, setTranscript] = useState<ConversationMessage[]>([]);
  const [scoreOverride, setScoreOverride] = useState('');
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSubmission = async () => {
      setLoading(true);
      try {
        if (!submissionId) return;
        const sub = await fetchSubmissionDetail(submissionId);
        setSubmission(sub);
        if (sub?.chatSessionId) {
          const messages = await fetchSubmissionTranscript(sub.chatSessionId);
          setTranscript(messages);
        }
      } catch (err) {
        console.error('Failed to load submission:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSubmission();
  }, [assignmentId, submissionId]);

  const aiFeedback = submission?.aiFeedback ?? null;

  const handleSubmitFeedback = async () => {
    setSaving(true);
    try {
      const score = scoreOverride ? parseInt(scoreOverride, 10) : (aiFeedback?.totalScore ?? 0);
      await gradeSubmission(submissionId!, score, comments);
      Alert.alert('Saved', 'Feedback submitted.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView className="flex-1 justify-center items-center">
          <ActivityIndicator color="#38BDF8" size="large" />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Back + Header */}
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center mb-4"
          >
            <Ionicons name="chevron-back" size={24} color="#38BDF8" />
            <Text
              className="text-base text-primary ml-1"
              style={{ fontFamily: 'Inter_600SemiBold' }}
            >
              Back
            </Text>
          </Pressable>

          <Text
            className="text-[28px] text-text-primary mb-4"
            style={{ fontFamily: 'Inter_700Bold' }}
            accessibilityRole="header"
          >
            Review Submission
          </Text>

          {/* Student Info */}
          <GlassSurface
            style={{ marginBottom: 16 }}
            innerStyle={{ padding: 16 }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: 'rgba(168, 85, 247, 0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="person" size={20} color="#A855F7" />
                </View>
                <View className="ml-3">
                  <Text
                    className="text-base text-text-primary"
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                  >
                    {submission?.studentName ?? 'Student'}
                  </Text>
                  <Text
                    className="text-xs text-text-secondary"
                    style={{ fontFamily: 'Inter_400Regular' }}
                  >
                    Submitted {formatDate(submission?.submittedAt ?? null)}
                  </Text>
                </View>
              </View>
              {submission && <StatusBadge status={submission.status} size="small" />}
            </View>

            {/* Duration + Late Badge */}
            <View className="flex-row items-center" style={{ gap: 12 }}>
              {submission?.conversationDurationMinutes != null && (
                <View className="flex-row items-center">
                  <Ionicons name="time-outline" size={14} color="#94A3B8" />
                  <Text
                    style={{
                      color: '#94A3B8',
                      fontSize: 12,
                      fontFamily: 'Inter_500Medium',
                      marginLeft: 4,
                    }}
                  >
                    {submission.conversationDurationMinutes} min
                  </Text>
                </View>
              )}
              {submission?.isLate && (
                <View
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      color: '#EF4444',
                      fontSize: 11,
                      fontFamily: 'Inter_600SemiBold',
                    }}
                  >
                    Late
                  </Text>
                </View>
              )}
            </View>
          </GlassSurface>

          {/* AI Rubric */}
          <Text
            className="text-xl text-text-primary mb-3"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            AI Evaluation
          </Text>
          {aiFeedback ? (
            <GlassSurface
              style={{ marginBottom: 16 }}
              innerStyle={{ padding: 16 }}
            >
              <RubricRow label="Participation" score={aiFeedback.participation} />
              <RubricRow label="Language Usage" score={aiFeedback.languageUsage} />
              <RubricRow
                label="Grammar & Vocabulary"
                score={aiFeedback.grammarVocabulary}
              />
              <RubricRow
                label="Duration Compliance"
                score={aiFeedback.durationCompliance}
              />
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255,255,255,0.08)',
                  marginTop: 8,
                  paddingTop: 10,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-base text-text-primary"
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                  >
                    Total Score
                  </Text>
                  <Text
                    style={{
                      color: '#38BDF8',
                      fontSize: 20,
                      fontFamily: 'Inter_700Bold',
                    }}
                  >
                    {aiFeedback.totalScore}%
                  </Text>
                </View>
              </View>

              {/* Summary */}
              {aiFeedback.summary ? (
                <Text
                  className="text-sm text-text-secondary mt-3"
                  style={{ fontFamily: 'Inter_400Regular' }}
                >
                  {aiFeedback.summary}
                </Text>
              ) : null}

              {/* Strengths */}
              {aiFeedback.strengths.length > 0 && (
                <View className="mt-3">
                  <Text
                    className="text-xs text-text-secondary mb-1"
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                  >
                    Strengths
                  </Text>
                  {aiFeedback.strengths.map((s, i) => (
                    <View key={i} className="flex-row items-start mb-1">
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color="#22C55E"
                        style={{ marginTop: 2, marginRight: 6 }}
                      />
                      <Text
                        className="text-sm text-text-primary flex-1"
                        style={{ fontFamily: 'Inter_400Regular' }}
                      >
                        {s}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Improvements */}
              {aiFeedback.improvements.length > 0 && (
                <View className="mt-3">
                  <Text
                    className="text-xs text-text-secondary mb-1"
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                  >
                    Areas for Improvement
                  </Text>
                  {aiFeedback.improvements.map((s, i) => (
                    <View key={i} className="flex-row items-start mb-1">
                      <Ionicons
                        name="arrow-up-circle"
                        size={14}
                        color="#F59E0B"
                        style={{ marginTop: 2, marginRight: 6 }}
                      />
                      <Text
                        className="text-sm text-text-primary flex-1"
                        style={{ fontFamily: 'Inter_400Regular' }}
                      >
                        {s}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </GlassSurface>
          ) : (
            <GlassSurface
              style={{ marginBottom: 16 }}
              innerStyle={{ padding: 20, alignItems: 'center' }}
            >
              <Ionicons name="analytics-outline" size={28} color="#64748B" />
              <Text
                className="text-sm text-text-secondary mt-2"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                AI evaluation not available
              </Text>
            </GlassSurface>
          )}

          {/* Transcript placeholder */}
          <Text
            className="text-xl text-text-primary mb-3"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Conversation Transcript
          </Text>
          {transcript.length > 0 ? (
            <TranscriptViewer messages={transcript} targetLanguage="es" />
          ) : (
            <GlassSurface
              style={{ marginBottom: 20 }}
              innerStyle={{ padding: 20, alignItems: 'center' }}
            >
              <Ionicons name="chatbox-outline" size={28} color="#64748B" />
              <Text
                className="text-sm text-text-secondary mt-2"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                No transcript available
              </Text>
            </GlassSurface>
          )}

          {/* Teacher Feedback */}
          <Text
            className="text-xl text-text-primary mb-3"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Teacher Feedback
          </Text>

          <Text
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Score Override (0-100)
          </Text>
          <GlassSurface style={{ marginBottom: 16 }} innerStyle={{ padding: 0 }}>
            <TextInput
              value={scoreOverride}
              onChangeText={setScoreOverride}
              placeholder="Leave blank to use AI score"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              style={{
                color: '#F1F5F9',
                fontSize: 16,
                fontFamily: 'Inter_400Regular',
                padding: 14,
              }}
              accessibilityLabel="Score override"
            />
          </GlassSurface>

          <Text
            className="text-sm text-text-secondary mb-2"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Comments
          </Text>
          <GlassSurface style={{ marginBottom: 24 }} innerStyle={{ padding: 0 }}>
            <TextInput
              value={comments}
              onChangeText={setComments}
              placeholder="Add feedback for the student..."
              placeholderTextColor="#64748B"
              multiline
              style={{
                color: '#F1F5F9',
                fontSize: 15,
                fontFamily: 'Inter_400Regular',
                padding: 14,
                minHeight: 100,
              }}
              accessibilityLabel="Teacher comments"
            />
          </GlassSurface>

          <GradientButton
            label="Submit Feedback"
            onPress={handleSubmitFeedback}
            loading={saving}
            accessibilityHint="Save your feedback and score for this submission"
          />
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
