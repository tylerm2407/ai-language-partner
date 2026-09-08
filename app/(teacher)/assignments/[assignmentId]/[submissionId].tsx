import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '../../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../../../../components/ui2/SlabCard';
import { SlabButton } from '../../../../components/ui2/SlabButton';
import { Ui2Input } from '../../../../components/ui2/Ui2Input';
import StatusBadge from '../../../../components/school/StatusBadge';
import TranscriptViewer from '../../../../components/school/TranscriptViewer';
import { fetchSubmissionDetail, fetchSubmissionTranscript, fetchAssignmentById, gradeSubmission } from '../../../../lib/supabase-queries';
import { useSchoolStore } from '../../../../stores/useSchoolStore';
import type { Assignment, AssignmentSubmission, ConversationMessage } from '../../../../types';
import { Ui2InlineError } from '../../../../components/ui2/Ui2InlineError';
import { loadErrorCopy, type ErrorCopy } from '../../../../lib/error-copy';
// `colors` is deliberately NOT imported: it is the fixed DARK palette. `ui2Shape`
// is a set of scheme-independent numbers.
import { ui2Shape } from '../../../../config/theme';
import { useUi2Theme } from '../../../../hooks/useUi2Theme';

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
  const { c } = useUi2Theme();
  return (
    <View className="flex-row items-center justify-between mb-2">
      <Text
        className="text-sm"
        style={{ fontFamily: 'Manrope_500Medium', color: c.muted }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: score >= 80 ? c.green : score >= 60 ? c.yellow : c.error,
          fontSize: 14,
          fontFamily: 'Manrope_700Bold',
        }}
      >
        {score}%
      </Text>
    </View>
  );
}

export default function GradingScreen() {
  const { c } = useUi2Theme();
  const goBack = useSafeBack('/(teacher)');
  const { assignmentId, submissionId } = useLocalSearchParams<{
    assignmentId: string;
    submissionId: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ErrorCopy | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
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
        // Resolve the assignment (source of the target language) by id. This
        // used to walk every classroom in a serial loop to find a row whose id
        // was already in hand.
        if (assignmentId) {
          setAssignment(await fetchAssignmentById(assignmentId));
        }
      } catch (err) {
        // Otherwise a failed load renders as an empty transcript, which a
        // teacher would reasonably read as the student having written nothing.
        console.error('Failed to load submission:', err);
        setLoadError(loadErrorCopy(err, 'this submission'));
      } finally {
        setLoading(false);
      }
    };
    loadSubmission();
  }, [assignmentId, submissionId, reloadKey]);

  const aiFeedback = submission?.aiFeedback ?? null;

  const handleSubmitFeedback = async () => {
    setSaving(true);
    try {
      const score = scoreOverride ? parseInt(scoreOverride, 10) : (aiFeedback?.totalScore ?? 0);
      await gradeSubmission(submissionId!, score, comments);
      Alert.alert('Saved', 'Feedback submitted.', [
        { text: 'OK', onPress: () => goBack() },
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
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView className="flex-1 justify-center items-center">
          <ActivityIndicator color={c.primary} size="large" />
        </SafeAreaView>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView className="flex-1 justify-center">
          <Ui2InlineError copy={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView
          className="flex-1 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back + Header */}
          <Pressable
            onPress={() => goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center mb-4"
          >
            <Ionicons name="chevron-back" size={24} color={c.primary} />
            <Text
              className="text-base ml-1"
              style={{ fontFamily: 'Manrope_600SemiBold', color: c.primary }}
            >
              Back
            </Text>
          </Pressable>

          <Text
            className="text-[28px] mb-4"
            style={{ fontFamily: 'Manrope_800ExtraBold', color: c.ink }}
            accessibilityRole="header"
          >
            Review Submission
          </Text>

          {/* Student Info */}
          <SlabCard style={{ marginBottom: 16, padding: 16 }}>
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: c.primaryTint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="person" size={20} color={c.onTint} />
                </View>
                <View className="ml-3">
                  <Text
                    className="text-base"
                    style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
                  >
                    {submission?.studentName ?? 'Student'}
                  </Text>
                  <Text
                    className="text-xs"
                    style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
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
                  <Ionicons name="time-outline" size={14} color={c.idle} />
                  <Text
                    style={{
                      color: c.muted,
                      fontSize: 12,
                      fontFamily: 'Manrope_500Medium',
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
                    borderWidth: ui2Shape.border,
                    borderColor: c.error,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      color: c.error,
                      fontSize: 11,
                      fontFamily: 'Manrope_600SemiBold',
                    }}
                  >
                    Late
                  </Text>
                </View>
              )}
            </View>
          </SlabCard>

          {/* AI Rubric */}
          <Text
            className="text-xl mb-3"
            style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
          >
            AI Evaluation
          </Text>
          {aiFeedback ? (
            <SlabCard style={{ marginBottom: 16, padding: 16 }}>
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
                  borderTopWidth: ui2Shape.border,
                  borderTopColor: c.cardBorder,
                  marginTop: 8,
                  paddingTop: 10,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-base"
                    style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
                  >
                    Total Score
                  </Text>
                  <Text
                    style={{
                      color: c.primary,
                      fontSize: 20,
                      fontFamily: 'Manrope_800ExtraBold',
                    }}
                  >
                    {aiFeedback.totalScore}%
                  </Text>
                </View>
              </View>

              {/* Summary */}
              {aiFeedback.summary ? (
                <Text
                  className="text-sm mt-3"
                  style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
                >
                  {aiFeedback.summary}
                </Text>
              ) : null}

              {/* Strengths */}
              {aiFeedback.strengths.length > 0 && (
                <View className="mt-3">
                  <Text
                    className="text-xs mb-1"
                    style={{ fontFamily: 'Manrope_600SemiBold', color: c.muted }}
                  >
                    Strengths
                  </Text>
                  {aiFeedback.strengths.map((s, i) => (
                    <View key={i} className="flex-row items-start mb-1">
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={c.green}
                        style={{ marginTop: 2, marginRight: 6 }}
                      />
                      <Text
                        className="text-sm flex-1"
                        style={{ fontFamily: 'Manrope_400Regular', color: c.ink }}
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
                    className="text-xs mb-1"
                    style={{ fontFamily: 'Manrope_600SemiBold', color: c.muted }}
                  >
                    Areas for Improvement
                  </Text>
                  {aiFeedback.improvements.map((s, i) => (
                    <View key={i} className="flex-row items-start mb-1">
                      <Ionicons
                        name="arrow-up-circle"
                        size={14}
                        color={c.yellow}
                        style={{ marginTop: 2, marginRight: 6 }}
                      />
                      <Text
                        className="text-sm flex-1"
                        style={{ fontFamily: 'Manrope_400Regular', color: c.ink }}
                      >
                        {s}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </SlabCard>
          ) : (
            <SlabCard style={{ marginBottom: 16, padding: 20, alignItems: 'center' }}>
              <Ionicons name="analytics-outline" size={28} color={c.idle} />
              <Text
                className="text-sm mt-2"
                style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
              >
                AI evaluation not available
              </Text>
            </SlabCard>
          )}

          {/* Transcript placeholder */}
          <Text
            className="text-xl mb-3"
            style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
          >
            Conversation Transcript
          </Text>
          {transcript.length > 0 ? (
            <TranscriptViewer
              messages={transcript}
              targetLanguage={assignment?.targetLanguage ?? 'en'}
            />
          ) : (
            <SlabCard style={{ marginBottom: 20, padding: 20, alignItems: 'center' }}>
              <Ionicons name="chatbox-outline" size={28} color={c.idle} />
              <Text
                className="text-sm mt-2"
                style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
              >
                No transcript available
              </Text>
            </SlabCard>
          )}

          {/* Teacher Feedback */}
          <Text
            className="text-xl mb-3"
            style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
          >
            Teacher Feedback
          </Text>

          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Manrope_600SemiBold', color: c.muted }}
          >
            Score Override (0-100)
          </Text>
          <Ui2Input
            value={scoreOverride}
            onChangeText={setScoreOverride}
            placeholder="Leave blank to use AI score"
            keyboardType="numeric"
            containerStyle={{ marginBottom: 16 }}
            accessibilityLabel="Score override"
          />

          <Text
            className="text-sm mb-2"
            style={{ fontFamily: 'Manrope_600SemiBold', color: c.muted }}
          >
            Comments
          </Text>
          <Ui2Input
            value={comments}
            onChangeText={setComments}
            placeholder="Add feedback for the student..."
            multiline
            containerStyle={{ marginBottom: 24 }}
            accessibilityLabel="Teacher comments"
          />

          <SlabButton
            label="Submit Feedback"
            onPress={handleSubmitFeedback}
            loading={saving}
            accessibilityHint="Save your feedback and score for this submission"
          />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
