import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '../../../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../../../../../components/ui2/SlabCard';
import { SlabButton } from '../../../../../components/ui2/SlabButton';
import { useUi2Theme } from '../../../../../hooks/useUi2Theme';
import StatusBadge from '../../../../../components/school/StatusBadge';
import {
  fetchClassroomStudents,
  fetchClassroomAssignments,
  fetchAssignmentSubmissions,
} from '../../../../../lib/supabase-queries';
import type { SubmissionStatus } from '../../../../../types';

interface StudentInfo {
  id: string;
  name: string;
  enrolledAt: string;
}

interface SubmissionRow {
  id: string;
  assignmentTitle: string;
  status: SubmissionStatus;
  score: number | null;
  submittedAt: string | null;
}

export default function StudentProgressScreen() {
  const { c } = useUi2Theme();
  const goBack = useSafeBack('/(teacher)');
  const { classId, studentId } = useLocalSearchParams<{
    classId: string;
    studentId: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  const load = useCallback(async () => {
    if (!classId || !studentId) return;
    setLoading(true);
    setError(null);
    try {
      const [enrollments, assignments] = await Promise.all([
        fetchClassroomStudents(classId),
        fetchClassroomAssignments(classId),
      ]);

      const enrollment = enrollments.find((e) => e.studentId === studentId);
      setStudent(
        enrollment
          ? {
              id: enrollment.studentId,
              name: enrollment.displayName,
              enrolledAt: enrollment.enrolledAt,
            }
          : null,
      );

      // Per-assignment fetch (no batched cross-assignment query is exported),
      // filtered down to this student's submissions.
      const submissionArrays = await Promise.all(
        assignments.map((a) => fetchAssignmentSubmissions(a.id)),
      );
      const rows: SubmissionRow[] = [];
      assignments.forEach((assignment, i) => {
        const sub = submissionArrays[i].find((s) => s.studentId === studentId);
        if (sub) {
          rows.push({
            id: sub.id,
            assignmentTitle: assignment.title,
            status: sub.status,
            score: sub.finalScore ?? sub.autoScore,
            submittedAt: sub.submittedAt,
          });
        }
      });
      rows.sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
      setSubmissions(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load student data';
      setError(message);
      console.error('Failed to load student progress:', err);
    } finally {
      setLoading(false);
    }
  }, [classId, studentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView className="flex-1 justify-center items-center">
          <ActivityIndicator color={c.primary} size="large" />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
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
            {student?.name ?? 'Student'}
          </Text>

          {/* Error state + retry */}
          {error && (
            <SlabCard
              style={{ marginBottom: 20, padding: 20, alignItems: 'center' }}
            >
              <Ionicons name="warning-outline" size={32} color={c.error} />
              <Text
                className="text-sm mt-2 text-center"
                style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
              >
                {error}
              </Text>
              <SlabButton
                label="Retry"
                onPress={load}
                style={{ marginTop: 12, minWidth: 140 }}
                accessibilityHint="Retry loading student data"
              />
            </SlabCard>
          )}

          {/* Student Info Card */}
          <SlabCard
            style={{ marginBottom: 20 }}
          >
            <View className="flex-row items-center">
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: c.primaryTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="person" size={24} color={c.onTint} />
              </View>
              <View className="ml-4">
                <Text
                  className="text-lg"
                  style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
                >
                  {student?.name ?? 'Unknown'}
                </Text>
                <Text
                  className="text-sm"
                  style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
                >
                  Enrolled{' '}
                  {student?.enrolledAt
                    ? new Date(student.enrolledAt).toLocaleDateString(
                        undefined,
                        { month: 'long', day: 'numeric', year: 'numeric' },
                      )
                    : '—'}
                </Text>
              </View>
            </View>
          </SlabCard>

          {/* Assignment History */}
          <Text
            className="text-xl mb-3"
            style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
          >
            Assignment History
          </Text>

          {submissions.length === 0 ? (
            <SlabCard
              style={{ marginBottom: 16, padding: 20, alignItems: 'center' }}
            >
              <Ionicons name="document-text-outline" size={32} color={c.idle} />
              <Text
                className="text-sm mt-2"
                style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
              >
                No submissions yet
              </Text>
            </SlabCard>
          ) : (
            submissions.map((sub) => (
              <SlabCard
                key={sub.id}
                style={{ marginBottom: 10, padding: 14 }}
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text
                    className="text-base flex-1 mr-2"
                    style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
                    numberOfLines={1}
                  >
                    {sub.assignmentTitle}
                  </Text>
                  <StatusBadge status={sub.status} size="small" />
                </View>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  {sub.score !== null && (
                    <Text
                      style={{
                        color: c.green,
                        fontSize: 13,
                        fontFamily: 'Manrope_600SemiBold',
                      }}
                    >
                      {sub.score}/100
                    </Text>
                  )}
                  {sub.submittedAt && (
                    <Text
                      className="text-xs"
                      style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
                    >
                      {new Date(sub.submittedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  )}
                </View>
              </SlabCard>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
