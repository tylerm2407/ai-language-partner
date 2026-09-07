import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '../../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../../../../components/ui2/SlabCard';
import StatusBadge from '../../../../components/school/StatusBadge';
import { fetchAssignmentById, fetchAssignmentSubmissions } from '../../../../lib/supabase-queries';
import { useSchoolStore } from '../../../../stores/useSchoolStore';
import type { Assignment, AssignmentSubmission } from '../../../../types';
import { Ui2InlineError } from '../../../../components/ui2/Ui2InlineError';
import { loadErrorCopy, type ErrorCopy } from '../../../../lib/error-copy';
import { useUi2Theme } from '../../../../hooks/useUi2Theme';

const MODE_LABEL: Record<string, string> = {
  text: 'Text',
  voice: 'Voice',
  either: 'Text or Voice',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SubmissionsListScreen() {
  const { c } = useUi2Theme();
  const router = useRouter();
  const goBack = useSafeBack('/(teacher)');
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (assignmentId) {
          // One query by primary key, and it runs alongside the submissions
          // fetch. This used to walk every classroom the teacher owns, calling
          // fetchClassroomAssignments on each in a serial loop, to find a row
          // whose id was already in hand — up to eight sequential round trips.
          const [found, subs] = await Promise.all([
            fetchAssignmentById(assignmentId),
            fetchAssignmentSubmissions(assignmentId),
          ]);
          setAssignment(found);
          setSubmissions(subs);
        }
      } catch (err) {
        // Otherwise an outage renders the assignment as having no submissions,
        // which a teacher reads as "nobody has done the work".
        console.error('Failed to load assignment detail:', err);
        setError(loadErrorCopy(err, 'this assignment'));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [assignmentId, reloadKey]);

  const totalSubmissions = submissions.length;
  const completed = submissions.filter(
    (s) => s.status === 'submitted' || s.status === 'graded',
  ).length;
  const avgScore =
    submissions.filter((s) => s.finalScore !== null).length > 0
      ? Math.round(
          submissions
            .filter((s) => s.finalScore !== null)
            .reduce((sum, s) => sum + (s.finalScore ?? 0), 0) /
            submissions.filter((s) => s.finalScore !== null).length,
        )
      : null;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView className="flex-1 justify-center items-center">
          <ActivityIndicator color={c.primary} size="large" />
        </SafeAreaView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView className="flex-1 justify-center">
          <Ui2InlineError copy={error} onRetry={() => setReloadKey((k) => k + 1)} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-1 px-4 pt-2">
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
              style={{ fontFamily: 'Nunito_600SemiBold', color: c.primary }}
            >
              Back
            </Text>
          </Pressable>

          <Text
            className="text-[28px] mb-2"
            style={{ fontFamily: 'Nunito_800ExtraBold', color: c.ink }}
            accessibilityRole="header"
          >
            {assignment?.title ?? 'Assignment'}
          </Text>

          {/* Assignment Info */}
          {assignment && (
            <SlabCard style={{ marginBottom: 16, padding: 14 }}>
              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {assignment.scenarioKey && (
                  <View className="flex-row items-center">
                    <Ionicons name="chatbubbles-outline" size={14} color={c.idle} />
                    <Text
                      style={{
                        color: c.muted,
                        fontSize: 12,
                        fontFamily: 'Nunito_500Medium',
                        marginLeft: 4,
                      }}
                    >
                      {assignment.scenarioKey}
                    </Text>
                  </View>
                )}
                <View className="flex-row items-center">
                  <Ionicons name="calendar-outline" size={14} color={c.idle} />
                  <Text
                    style={{
                      color: c.muted,
                      fontSize: 12,
                      fontFamily: 'Nunito_500Medium',
                      marginLeft: 4,
                    }}
                  >
                    Due {formatDate(assignment.dueAt)}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Ionicons name="options-outline" size={14} color={c.idle} />
                  <Text
                    style={{
                      color: c.muted,
                      fontSize: 12,
                      fontFamily: 'Nunito_500Medium',
                      marginLeft: 4,
                    }}
                  >
                    {MODE_LABEL[assignment.mode] ?? assignment.mode}
                  </Text>
                </View>
                {assignment.minDurationMinutes > 0 && (
                  <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={14} color={c.idle} />
                    <Text
                      style={{
                        color: c.muted,
                        fontSize: 12,
                        fontFamily: 'Nunito_500Medium',
                        marginLeft: 4,
                      }}
                    >
                      {assignment.minDurationMinutes} min
                    </Text>
                  </View>
                )}
              </View>
            </SlabCard>
          )}

          {/* Stats Row */}
          <View className="flex-row mb-4" style={{ gap: 10 }}>
            <SlabCard style={{ flex: 1, padding: 12, alignItems: 'center' }}>
              <Text
                className="text-lg"
                style={{ fontFamily: 'Nunito_700Bold', color: c.ink }}
              >
                {totalSubmissions}
              </Text>
              <Text
                className="text-xs"
                style={{ fontFamily: 'Nunito_500Medium', color: c.muted }}
              >
                Total
              </Text>
            </SlabCard>
            <SlabCard style={{ flex: 1, padding: 12, alignItems: 'center' }}>
              <Text
                className="text-lg"
                style={{ fontFamily: 'Nunito_700Bold', color: c.ink }}
              >
                {completed}
              </Text>
              <Text
                className="text-xs"
                style={{ fontFamily: 'Nunito_500Medium', color: c.muted }}
              >
                Completed
              </Text>
            </SlabCard>
            <SlabCard style={{ flex: 1, padding: 12, alignItems: 'center' }}>
              <Text
                className="text-lg"
                style={{ fontFamily: 'Nunito_700Bold', color: c.ink }}
              >
                {avgScore !== null ? `${avgScore}%` : '—'}
              </Text>
              <Text
                className="text-xs"
                style={{ fontFamily: 'Nunito_500Medium', color: c.muted }}
              >
                Avg Score
              </Text>
            </SlabCard>
          </View>

          {/* Submissions List */}
          {submissions.length === 0 ? (
            <View className="flex-1 justify-center items-center" style={{ paddingBottom: 80 }}>
              <Ionicons name="people-outline" size={48} color={c.idle} />
              <Text
                className="text-base mt-3"
                style={{ fontFamily: 'Nunito_600SemiBold', color: c.ink }}
              >
                No submissions yet
              </Text>
              <Text
                className="text-sm mt-1 text-center px-8"
                style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}
              >
                Submissions will appear here as students complete the assignment.
              </Text>
            </View>
          ) : (
            <FlatList
              data={submissions}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() =>
                    router.push(
                      `/assignments/${assignmentId}/${item.id}` as any,
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Submission by ${item.studentName ?? 'student'}`}
                >
                  <SlabCard style={{ marginBottom: 10, padding: 14 }}>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text
                        className="text-base flex-1 mr-2"
                        style={{ fontFamily: 'Nunito_600SemiBold', color: c.ink }}
                        numberOfLines={1}
                      >
                        {item.studentName ?? 'Student'}
                      </Text>
                      <StatusBadge status={item.status} size="small" />
                    </View>
                    <View
                      className="flex-row items-center"
                      style={{ gap: 12 }}
                    >
                      {item.finalScore !== null && (
                        <Text
                          style={{
                            color: c.green,
                            fontSize: 13,
                            fontFamily: 'Nunito_600SemiBold',
                          }}
                        >
                          {item.finalScore}/{assignment?.maxPoints ?? 100}
                        </Text>
                      )}
                      {item.submittedAt && (
                        <Text
                          className="text-xs"
                          style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}
                        >
                          {formatDate(item.submittedAt)}
                        </Text>
                      )}
                      {item.isLate && (
                        <Text
                          style={{
                            color: c.error,
                            fontSize: 11,
                            fontFamily: 'Nunito_600SemiBold',
                          }}
                        >
                          LATE
                        </Text>
                      )}
                    </View>
                  </SlabCard>
                </Pressable>
              )}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
