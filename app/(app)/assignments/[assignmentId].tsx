import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { fetchStudentAssignments, startAssignment } from '../../../lib/supabase-queries';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { SlabButton } from '../../../components/ui2/SlabButton';
import StatusBadge from '../../../components/school/StatusBadge';
import { Ui2InlineError } from '../../../components/ui2/Ui2InlineError';
import { loadErrorCopy, type ErrorCopy } from '../../../lib/error-copy';
import RubricDisplay from '../../../components/school/RubricDisplay';
import type { Assignment, AssignmentSubmission, SubmissionStatus } from '../../../types';
import { useUi2Theme } from '../../../hooks/useUi2Theme';

const MODE_LABELS: Record<string, string> = {
  text: 'Text Only',
  voice: 'Voice Only',
  either: 'Text or Voice',
};

const MODE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  text: 'chatbubble-outline',
  voice: 'mic-outline',
  either: 'swap-horizontal-outline',
};

function formatDueCountdown(dueAt: string | null): string {
  if (!dueAt) return 'No due date';
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const diff = due - now;
  if (diff < 0) return 'Overdue';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 1) return `Due in ${days} days`;
  if (hours > 1) return `Due in ${hours} hours`;
  return 'Due very soon';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AssignmentDetailScreen() {
  const { c } = useUi2Theme();
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const router = useRouter();
  const goBack = useSafeBack('/(app)');
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<(Assignment & { submission?: AssignmentSubmission }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<ErrorCopy | null>(null);

  const loadAssignment = useCallback(async () => {
    if (!user?.id || !assignmentId) return;
    setIsLoading(true);
    setError(null);
    try {
      const all = await fetchStudentAssignments(user.id);
      const found = all.find((a) => a.id === assignmentId);
      setAssignment(found ?? null);
    } catch (err) {
      // "Assignment not found." and "we couldn't reach the server" are
      // different facts, and only one of them is worth retrying.
      console.error('Failed to load assignment:', err);
      setError(loadErrorCopy(err, 'this assignment'));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, assignmentId]);

  useEffect(() => {
    loadAssignment();
  }, [loadAssignment]);

  const submissionStatus: SubmissionStatus = assignment?.submission?.status ?? 'not_started';

  const handleStart = async () => {
    if (!assignmentId || starting) return;
    setStarting(true);
    try {
      const { chatSessionId } = await startAssignment(assignmentId);
      router.push({
        pathname: '/chat',
        params: { assignmentId, chatSessionId },
      } as any);
    } catch (err) {
      // The button used to spin, stop, and leave the screen unchanged — the
      // natural response to which is to tap it again.
      console.error('Failed to start assignment:', err);
      Alert.alert(
        "Couldn't start this assignment",
        'Please check your connection and try again.',
        [{ text: 'OK' }],
      );
    } finally {
      setStarting(false);
    }
  };

  const handleContinue = () => {
    if (!assignmentId || !assignment?.submission?.chatSessionId) return;
    router.push({
      pathname: '/chat',
      params: {
        assignmentId,
        chatSessionId: assignment.submission.chatSessionId,
      },
    } as any);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.primary} />
        </SafeAreaView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center px-4 py-3">
            <Pressable
              onPress={() => goBack()}
              hitSlop={8}
              className="w-10 h-10 items-center justify-center rounded-full" style={{ backgroundColor: c.card }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color={c.ink} />
            </Pressable>
            <Text className="text-lg font-semibold ml-3" style={{ color: c.ink }}>Assignment</Text>
          </View>
          <Ui2InlineError copy={error} onRetry={loadAssignment} />
        </SafeAreaView>
      </View>
    );
  }

  if (!assignment) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center px-4 py-3">
            <Pressable
              onPress={() => goBack()}
              hitSlop={8}
              className="w-10 h-10 items-center justify-center rounded-full" style={{ backgroundColor: c.card }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color={c.ink} />
            </Pressable>
            <Text className="text-lg font-semibold ml-3" style={{ color: c.ink }}>Assignment</Text>
          </View>
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-base text-center" style={{ color: c.muted }}>Assignment not found.</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => goBack()}
            hitSlop={8}
            className="w-10 h-10 items-center justify-center rounded-full" style={{ backgroundColor: c.card }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={c.ink} />
          </Pressable>
          <Text className="text-lg font-semibold ml-3 flex-1" style={{ color: c.ink }} numberOfLines={1}>
            Assignment
          </Text>
        </View>

        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Assignment Info Card */}
          <SlabCard style={{ marginBottom: 16 }}>
            <View className="p-5">
              <Text className="text-xl font-bold mb-2" style={{ color: c.ink }}>{assignment.title}</Text>
              {assignment.description ? (
                <Text className="text-sm mb-4" style={{ color: c.muted }}>{assignment.description}</Text>
              ) : null}

              {/* Scenario */}
              {(assignment.scenarioKey ?? assignment.customScenario) && (
                <View className="flex-row items-center mb-3">
                  <Ionicons name="chatbubbles-outline" size={18} color={c.primary} />
                  <Text className="text-sm ml-2" style={{ color: c.ink }}>
                    {assignment.customScenario?.label ?? assignment.scenarioKey}
                  </Text>
                </View>
              )}

              {/* Language & Level */}
              <View className="flex-row items-center gap-2 mb-3">
                <View className="rounded-full px-3 py-1" style={{ backgroundColor: c.primaryTint }}>
                  <Text className="text-xs font-semibold" style={{ color: c.primary }}>
                    {assignment.targetLanguage.toUpperCase()}
                  </Text>
                </View>
                <View className="rounded-full px-3 py-1" style={{ backgroundColor: c.primaryTint }}>
                  <Text className="text-xs font-semibold capitalize" style={{ color: c.primary }}>
                    {assignment.level.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              {/* Duration */}
              <View className="flex-row items-center mb-3">
                <Ionicons name="time-outline" size={18} color={c.idle} />
                <Text className="text-sm ml-2" style={{ color: c.muted }}>
                  Min duration: {assignment.minDurationMinutes} minutes
                </Text>
              </View>

              {/* Mode */}
              <View className="flex-row items-center mb-3">
                <Ionicons name={MODE_ICONS[assignment.mode] ?? 'swap-horizontal-outline'} size={18} color={c.idle} />
                <Text className="text-sm ml-2" style={{ color: c.muted }}>
                  Mode: {MODE_LABELS[assignment.mode] ?? assignment.mode}
                </Text>
              </View>

              {/* Due date */}
              <View className="flex-row items-center mb-3">
                <Ionicons name="calendar-outline" size={18} color={c.idle} />
                <Text className="text-sm ml-2" style={{ color: c.muted }}>
                  {assignment.dueAt ? formatDate(assignment.dueAt) : 'No due date'}
                </Text>
                {assignment.dueAt && (
                  <Text className="text-xs ml-2" style={{ color: c.idle }}>
                    ({formatDueCountdown(assignment.dueAt)})
                  </Text>
                )}
              </View>

              {/* Status */}
              <StatusBadge status={submissionStatus} />
            </View>
          </SlabCard>

          {/* Teacher Instructions */}
          {assignment.instructions ? (
            <SlabCard style={{ marginBottom: 16 }}>
              <View className="p-5">
                <Text className="text-base font-semibold mb-2" style={{ color: c.ink }}>Teacher Instructions</Text>
                <Text className="text-sm" style={{ color: c.muted }}>{assignment.instructions}</Text>
              </View>
            </SlabCard>
          ) : null}

          {/* Vocabulary & Grammar Focus */}
          {(assignment.vocabularyFocus.length > 0 || assignment.grammarFocus.length > 0) && (
            <SlabCard style={{ marginBottom: 16 }}>
              <View className="p-5">
                {assignment.vocabularyFocus.length > 0 && (
                  <View className="mb-3">
                    <Text className="text-sm font-semibold mb-2" style={{ color: c.ink }}>Vocabulary Focus</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {assignment.vocabularyFocus.map((word) => (
                        <View key={word} className="rounded-full px-3 py-1" style={{ backgroundColor: c.primaryTint }}>
                          <Text className="text-xs" style={{ color: c.primary }}>{word}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {assignment.grammarFocus.length > 0 && (
                  <View>
                    <Text className="text-sm font-semibold mb-2" style={{ color: c.ink }}>Grammar Focus</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {assignment.grammarFocus.map((topic) => (
                        <View key={topic} className="rounded-full px-3 py-1" style={{ backgroundColor: c.primaryTint }}>
                          <Text className="text-xs" style={{ color: c.primary }}>{topic}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </SlabCard>
          )}

          {/* Status-dependent CTA */}
          {submissionStatus === 'not_started' && (
            <SlabButton
              label={starting ? 'Starting...' : 'Start Conversation'}
              onPress={handleStart}
              disabled={starting}
              style={{ marginBottom: 16 }}
            />
          )}

          {submissionStatus === 'in_progress' && (
            <View>
              {assignment.submission?.startedAt && (
                <Text className="text-sm text-center mb-3" style={{ color: c.muted }}>
                  Time so far:{' '}
                  {Math.round(
                    (Date.now() - new Date(assignment.submission.startedAt).getTime()) / (1000 * 60)
                  )}{' '}
                  min
                </Text>
              )}
              <SlabButton
                label="Continue Conversation"
                onPress={handleContinue}
                style={{ marginBottom: 16 }}
              />
            </View>
          )}

          {submissionStatus === 'submitted' && (
            <SlabCard style={{ marginBottom: 16 }}>
              <View className="p-5 items-center">
                <Ionicons name="checkmark-circle" size={48} color={c.green} />
                <Text className="text-base font-semibold mt-3" style={{ color: c.ink }}>
                  Submitted on {formatDate(assignment.submission?.submittedAt ?? null)}
                </Text>
                <Text className="text-sm mt-1" style={{ color: c.muted }}>Waiting for grade</Text>
              </View>
            </SlabCard>
          )}

          {submissionStatus === 'graded' && assignment.submission && (
            <View>
              {/* Score circle */}
              <SlabCard style={{ marginBottom: 16 }}>
                <View className="p-5 items-center">
                  <View className="w-20 h-20 rounded-full border-4 items-center justify-center" style={{
                    borderColor: (assignment.submission.finalScore ?? 0) >= 80 ? c.green :
                      (assignment.submission.finalScore ?? 0) >= 60 ? c.yellow : c.error,
                  }}>
                    <Text className="text-2xl font-bold" style={{ color: c.ink }}>
                      {assignment.submission.finalScore ?? '-'}
                    </Text>
                  </View>
                  <Text className="text-sm mt-2" style={{ color: c.muted }}>
                    out of {assignment.maxPoints} points
                  </Text>
                </View>
              </SlabCard>

              {/* Rubric */}
              {assignment.submission.aiFeedback && (
                <RubricDisplay grade={assignment.submission.aiFeedback} />
              )}

              {/* Teacher feedback */}
              {assignment.submission.teacherFeedback && (
                <SlabCard style={{ marginBottom: 16, marginTop: 16 }}>
                  <View className="p-5">
                    <Text className="text-base font-semibold mb-2" style={{ color: c.ink }}>Teacher Feedback</Text>
                    <Text className="text-sm" style={{ color: c.muted }}>{assignment.submission.teacherFeedback}</Text>
                  </View>
                </SlabCard>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
