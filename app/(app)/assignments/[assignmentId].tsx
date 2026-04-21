import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { fetchStudentAssignments, startAssignment } from '../../../lib/supabase-queries';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../components/ui/GlassSurface';
import { GradientButton } from '../../../components/ui/GradientButton';
import StatusBadge from '../../../components/school/StatusBadge';
import RubricDisplay from '../../../components/school/RubricDisplay';
import type { Assignment, AssignmentSubmission, SubmissionStatus } from '../../../types';

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
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<(Assignment & { submission?: AssignmentSubmission }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const loadAssignment = useCallback(async () => {
    if (!user?.id || !assignmentId) return;
    setIsLoading(true);
    try {
      const all = await fetchStudentAssignments(user.id);
      const found = all.find((a) => a.id === assignmentId);
      setAssignment(found ?? null);
    } catch (err) {
      console.error('Failed to load assignment:', err);
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
      console.error('Failed to start assignment:', err);
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
      <GradientBackground>
        <SafeAreaView className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#38BDF8" />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!assignment) {
    return (
      <GradientBackground>
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center px-4 py-3">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 items-center justify-center rounded-full bg-dark-card"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color="#E2E8F0" />
            </Pressable>
            <Text className="text-lg font-semibold text-text-primary ml-3">Assignment</Text>
          </View>
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-text-secondary text-base text-center">Assignment not found.</Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-dark-card"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color="#E2E8F0" />
          </Pressable>
          <Text className="text-lg font-semibold text-text-primary ml-3 flex-1" numberOfLines={1}>
            Assignment
          </Text>
        </View>

        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Assignment Info Card */}
          <GlassSurface style={{ marginBottom: 16 }}>
            <View className="p-5">
              <Text className="text-xl font-bold text-text-primary mb-2">{assignment.title}</Text>
              {assignment.description ? (
                <Text className="text-sm text-text-secondary mb-4">{assignment.description}</Text>
              ) : null}

              {/* Scenario */}
              {(assignment.scenarioKey ?? assignment.customScenario) && (
                <View className="flex-row items-center mb-3">
                  <Ionicons name="chatbubbles-outline" size={18} color="#A855F7" />
                  <Text className="text-sm text-text-primary ml-2">
                    {assignment.customScenario?.label ?? assignment.scenarioKey}
                  </Text>
                </View>
              )}

              {/* Language & Level */}
              <View className="flex-row items-center gap-2 mb-3">
                <View className="bg-primary/15 rounded-full px-3 py-1">
                  <Text className="text-xs font-semibold text-primary">
                    {assignment.targetLanguage.toUpperCase()}
                  </Text>
                </View>
                <View className="bg-primary/15 rounded-full px-3 py-1">
                  <Text className="text-xs font-semibold text-primary capitalize">
                    {assignment.level.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              {/* Duration */}
              <View className="flex-row items-center mb-3">
                <Ionicons name="time-outline" size={18} color="#64748B" />
                <Text className="text-sm text-text-secondary ml-2">
                  Min duration: {assignment.minDurationMinutes} minutes
                </Text>
              </View>

              {/* Mode */}
              <View className="flex-row items-center mb-3">
                <Ionicons name={MODE_ICONS[assignment.mode] ?? 'swap-horizontal-outline'} size={18} color="#64748B" />
                <Text className="text-sm text-text-secondary ml-2">
                  Mode: {MODE_LABELS[assignment.mode] ?? assignment.mode}
                </Text>
              </View>

              {/* Due date */}
              <View className="flex-row items-center mb-3">
                <Ionicons name="calendar-outline" size={18} color="#64748B" />
                <Text className="text-sm text-text-secondary ml-2">
                  {assignment.dueAt ? formatDate(assignment.dueAt) : 'No due date'}
                </Text>
                {assignment.dueAt && (
                  <Text className="text-xs text-text-tertiary ml-2">
                    ({formatDueCountdown(assignment.dueAt)})
                  </Text>
                )}
              </View>

              {/* Status */}
              <StatusBadge status={submissionStatus} />
            </View>
          </GlassSurface>

          {/* Teacher Instructions */}
          {assignment.instructions ? (
            <GlassSurface style={{ marginBottom: 16 }}>
              <View className="p-5">
                <Text className="text-base font-semibold text-text-primary mb-2">Teacher Instructions</Text>
                <Text className="text-sm text-text-secondary">{assignment.instructions}</Text>
              </View>
            </GlassSurface>
          ) : null}

          {/* Vocabulary & Grammar Focus */}
          {(assignment.vocabularyFocus.length > 0 || assignment.grammarFocus.length > 0) && (
            <GlassSurface style={{ marginBottom: 16 }}>
              <View className="p-5">
                {assignment.vocabularyFocus.length > 0 && (
                  <View className="mb-3">
                    <Text className="text-sm font-semibold text-text-primary mb-2">Vocabulary Focus</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {assignment.vocabularyFocus.map((word) => (
                        <View key={word} className="bg-primary/15 rounded-full px-3 py-1">
                          <Text className="text-xs text-primary">{word}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {assignment.grammarFocus.length > 0 && (
                  <View>
                    <Text className="text-sm font-semibold text-text-primary mb-2">Grammar Focus</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {assignment.grammarFocus.map((topic) => (
                        <View key={topic} className="bg-primary/15 rounded-full px-3 py-1">
                          <Text className="text-xs text-primary">{topic}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </GlassSurface>
          )}

          {/* Status-dependent CTA */}
          {submissionStatus === 'not_started' && (
            <GradientButton
              label={starting ? 'Starting...' : 'Start Conversation'}
              onPress={handleStart}
              disabled={starting}
              style={{ marginBottom: 16 }}
            />
          )}

          {submissionStatus === 'in_progress' && (
            <View>
              {assignment.submission?.startedAt && (
                <Text className="text-sm text-text-secondary text-center mb-3">
                  Time so far:{' '}
                  {Math.round(
                    (Date.now() - new Date(assignment.submission.startedAt).getTime()) / (1000 * 60)
                  )}{' '}
                  min
                </Text>
              )}
              <GradientButton
                label="Continue Conversation"
                onPress={handleContinue}
                style={{ marginBottom: 16 }}
              />
            </View>
          )}

          {submissionStatus === 'submitted' && (
            <GlassSurface style={{ marginBottom: 16 }}>
              <View className="p-5 items-center">
                <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
                <Text className="text-base font-semibold text-text-primary mt-3">
                  Submitted on {formatDate(assignment.submission?.submittedAt ?? null)}
                </Text>
                <Text className="text-sm text-text-secondary mt-1">Waiting for grade</Text>
              </View>
            </GlassSurface>
          )}

          {submissionStatus === 'graded' && assignment.submission && (
            <View>
              {/* Score circle */}
              <GlassSurface style={{ marginBottom: 16 }}>
                <View className="p-5 items-center">
                  <View className="w-20 h-20 rounded-full border-4 items-center justify-center" style={{
                    borderColor: (assignment.submission.finalScore ?? 0) >= 80 ? '#22C55E' :
                      (assignment.submission.finalScore ?? 0) >= 60 ? '#F59E0B' : '#EF4444',
                  }}>
                    <Text className="text-2xl font-bold text-text-primary">
                      {assignment.submission.finalScore ?? '-'}
                    </Text>
                  </View>
                  <Text className="text-sm text-text-secondary mt-2">
                    out of {assignment.maxPoints} points
                  </Text>
                </View>
              </GlassSurface>

              {/* Rubric */}
              {assignment.submission.aiFeedback && (
                <RubricDisplay grade={assignment.submission.aiFeedback} />
              )}

              {/* Teacher feedback */}
              {assignment.submission.teacherFeedback && (
                <GlassSurface style={{ marginBottom: 16, marginTop: 16 }}>
                  <View className="p-5">
                    <Text className="text-base font-semibold text-text-primary mb-2">Teacher Feedback</Text>
                    <Text className="text-sm text-text-secondary">{assignment.submission.teacherFeedback}</Text>
                  </View>
                </GlassSurface>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
