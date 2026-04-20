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
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../../components/ui/GlassSurface';
import StatusBadge from '../../../../components/school/StatusBadge';
import { fetchClassroomAssignments, fetchAssignmentSubmissions } from '../../../../lib/supabase-queries';
import { useSchoolStore } from '../../../../stores/useSchoolStore';
import type { Assignment, AssignmentSubmission } from '../../../../types';

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
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { classrooms } = useSchoolStore.getState();
        for (const classroom of classrooms) {
          const assignments = await fetchClassroomAssignments(classroom.id);
          const found = assignments.find((a) => a.id === assignmentId);
          if (found) {
            setAssignment(found);
            break;
          }
        }
        if (assignmentId) {
          const subs = await fetchAssignmentSubmissions(assignmentId);
          setSubmissions(subs);
        }
      } catch (err) {
        console.error('Failed to load assignment detail:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [assignmentId]);

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
        <View className="flex-1 px-4 pt-2">
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
            className="text-[28px] text-text-primary mb-2"
            style={{ fontFamily: 'Inter_700Bold' }}
            accessibilityRole="header"
          >
            {assignment?.title ?? 'Assignment'}
          </Text>

          {/* Assignment Info */}
          {assignment && (
            <GlassSurface
              style={{ marginBottom: 16 }}
              innerStyle={{ padding: 14 }}
            >
              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {assignment.scenarioKey && (
                  <View className="flex-row items-center">
                    <Ionicons name="chatbubbles-outline" size={14} color="#94A3B8" />
                    <Text
                      style={{
                        color: '#94A3B8',
                        fontSize: 12,
                        fontFamily: 'Inter_500Medium',
                        marginLeft: 4,
                      }}
                    >
                      {assignment.scenarioKey}
                    </Text>
                  </View>
                )}
                <View className="flex-row items-center">
                  <Ionicons name="calendar-outline" size={14} color="#94A3B8" />
                  <Text
                    style={{
                      color: '#94A3B8',
                      fontSize: 12,
                      fontFamily: 'Inter_500Medium',
                      marginLeft: 4,
                    }}
                  >
                    Due {formatDate(assignment.dueAt)}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Ionicons name="options-outline" size={14} color="#94A3B8" />
                  <Text
                    style={{
                      color: '#94A3B8',
                      fontSize: 12,
                      fontFamily: 'Inter_500Medium',
                      marginLeft: 4,
                    }}
                  >
                    {MODE_LABEL[assignment.mode] ?? assignment.mode}
                  </Text>
                </View>
                {assignment.minDurationMinutes > 0 && (
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
                      {assignment.minDurationMinutes} min
                    </Text>
                  </View>
                )}
              </View>
            </GlassSurface>
          )}

          {/* Stats Row */}
          <View className="flex-row mb-4" style={{ gap: 10 }}>
            <GlassSurface
              style={{ flex: 1 }}
              innerStyle={{ padding: 12, alignItems: 'center' }}
            >
              <Text
                className="text-lg text-text-primary"
                style={{ fontFamily: 'Inter_700Bold' }}
              >
                {totalSubmissions}
              </Text>
              <Text
                className="text-xs text-text-secondary"
                style={{ fontFamily: 'Inter_500Medium' }}
              >
                Total
              </Text>
            </GlassSurface>
            <GlassSurface
              style={{ flex: 1 }}
              innerStyle={{ padding: 12, alignItems: 'center' }}
            >
              <Text
                className="text-lg text-text-primary"
                style={{ fontFamily: 'Inter_700Bold' }}
              >
                {completed}
              </Text>
              <Text
                className="text-xs text-text-secondary"
                style={{ fontFamily: 'Inter_500Medium' }}
              >
                Completed
              </Text>
            </GlassSurface>
            <GlassSurface
              style={{ flex: 1 }}
              innerStyle={{ padding: 12, alignItems: 'center' }}
            >
              <Text
                className="text-lg text-text-primary"
                style={{ fontFamily: 'Inter_700Bold' }}
              >
                {avgScore !== null ? `${avgScore}%` : '—'}
              </Text>
              <Text
                className="text-xs text-text-secondary"
                style={{ fontFamily: 'Inter_500Medium' }}
              >
                Avg Score
              </Text>
            </GlassSurface>
          </View>

          {/* Submissions List */}
          {submissions.length === 0 ? (
            <View className="flex-1 justify-center items-center" style={{ paddingBottom: 80 }}>
              <Ionicons name="people-outline" size={48} color="#64748B" />
              <Text
                className="text-base text-text-primary mt-3"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                No submissions yet
              </Text>
              <Text
                className="text-sm text-text-secondary mt-1 text-center px-8"
                style={{ fontFamily: 'Inter_400Regular' }}
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
                  <GlassSurface
                    style={{ marginBottom: 10 }}
                    innerStyle={{ padding: 14 }}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text
                        className="text-base text-text-primary flex-1 mr-2"
                        style={{ fontFamily: 'Inter_600SemiBold' }}
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
                            color: '#22C55E',
                            fontSize: 13,
                            fontFamily: 'Inter_600SemiBold',
                          }}
                        >
                          {item.finalScore}/{assignment?.maxPoints ?? 100}
                        </Text>
                      )}
                      {item.submittedAt && (
                        <Text
                          className="text-xs text-text-secondary"
                          style={{ fontFamily: 'Inter_400Regular' }}
                        >
                          {formatDate(item.submittedAt)}
                        </Text>
                      )}
                      {item.isLate && (
                        <Text
                          style={{
                            color: '#EF4444',
                            fontSize: 11,
                            fontFamily: 'Inter_600SemiBold',
                          }}
                        >
                          LATE
                        </Text>
                      )}
                    </View>
                  </GlassSurface>
                </Pressable>
              )}
            />
          )}
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}
