import { useEffect, useState, useCallback } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import { haptic } from '../../../../lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../../../../components/ui2/SlabCard';
import { SlabButton } from '../../../../components/ui2/SlabButton';
import AssignmentCard from '../../../../components/school/AssignmentCard';
import { useSchoolStore } from '../../../../stores/useSchoolStore';
import {
  fetchClassroomStudents,
  fetchClassroomAssignments,
} from '../../../../lib/supabase-queries';
import type { Classroom, Assignment } from '../../../../types';
// `colors` is deliberately not imported: it is the fixed DARK palette, so a
// screen reading it stays dark whatever the phone is set to.
import { useUi2Theme } from '../../../../hooks/useUi2Theme';

interface StudentRowData {
  id: string;
  name: string;
  enrolledAt: string;
}

type Tab = 'students' | 'assignments';

export default function ClassDetailScreen() {
  const { c } = useUi2Theme();
  const router = useRouter();
  const goBack = useSafeBack('/(teacher)');
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { classrooms } = useSchoolStore();
  const [tab, setTab] = useState<Tab>('students');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<StudentRowData[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const [enrollments, classAssignments] = await Promise.all([
        fetchClassroomStudents(classId),
        fetchClassroomAssignments(classId),
      ]);
      setStudents(
        enrollments.map((e) => ({
          id: e.studentId,
          name: e.displayName,
          enrolledAt: e.enrolledAt,
        })),
      );
      setAssignments(classAssignments);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load class data';
      setError(message);
      console.error('Failed to load class detail:', err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    const found = classrooms.find((c) => c.id === classId) ?? null;
    setClassroom(found);
  }, [classId, classrooms]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCopyInviteCode = useCallback(async () => {
    if (!classroom?.inviteCode) return;
    await Clipboard.setStringAsync(classroom.inviteCode);
    haptic('confirm');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [classroom?.inviteCode]);

  const renderStudentItem = useCallback(
    ({ item }: { item: StudentRowData }) => (
      <Pressable
        onPress={() =>
          router.push(`/classes/${classId}/students/${item.id}` as any)
        }
        accessibilityRole="button"
        accessibilityLabel={`Student: ${item.name}`}
      >
        <SlabCard
          style={{ marginBottom: 10, padding: 14 }}
        >
          <View className="flex-row items-center">
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: c.primaryTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="person-outline" size={18} color={c.onTint} />
            </View>
            <View className="ml-3 flex-1">
              <Text
                className="text-base"
                style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
              >
                {item.name}
              </Text>
              <Text
                className="text-xs"
                style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
              >
                Enrolled{' '}
                {new Date(item.enrolledAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.idle} />
          </View>
        </SlabCard>
      </Pressable>
    ),
    [classId, router, c.idle, c.ink, c.muted, c.onTint, c.primaryTint],
  );

  const renderAssignmentItem = useCallback(
    ({ item }: { item: Assignment }) => (
      <AssignmentCard
        assignment={item}
        onPress={() =>
          router.push(`/assignments/${item.id}` as any)
        }
      />
    ),
    [router],
  );

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
        <View className="flex-1 px-4 pt-2">
          {/* Back + Header */}
          <Pressable
            onPress={() => goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center mb-4 min-h-11 -ml-1 pl-1"
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
            className="text-[28px] mb-2"
            style={{ fontFamily: 'Manrope_800ExtraBold', color: c.ink }}
            accessibilityRole="header"
          >
            {classroom?.name ?? 'Class'}
          </Text>

          {/* Invite Code */}
          {classroom?.inviteCode && (
            <SlabCard
              style={{
                marginBottom: 16,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text
                  className="text-xs"
                  style={{ fontFamily: 'Manrope_500Medium', color: c.muted }}
                >
                  Invite Code
                </Text>
                <Text
                  className="text-lg"
                  style={{ fontFamily: 'Manrope_700Bold', letterSpacing: 2, color: c.primary }}
                >
                  {classroom.inviteCode}
                </Text>
              </View>
              <Pressable
                onPress={handleCopyInviteCode}
                accessibilityRole="button"
                accessibilityLabel={copied ? 'Invite code copied' : 'Copy invite code'}
                hitSlop={12}
                className="flex-row items-center"
                style={{ gap: 6 }}
              >
                {copied && (
                  <Text
                    style={{ color: c.green, fontSize: 12, fontFamily: 'Manrope_600SemiBold' }}
                  >
                    Copied
                  </Text>
                )}
                <Ionicons
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={20}
                  color={copied ? c.green : c.primary}
                />
              </Pressable>
            </SlabCard>
          )}

          {/* Segmented Control */}
          <View
            className="flex-row mb-4"
            style={{
              backgroundColor: c.surface2,
              borderRadius: 12,
              padding: 3,
            }}
          >
            {(['students', 'assignments'] as Tab[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t }}
                accessibilityLabel={t}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor:
                    tab === t
                      ? c.primaryTint
                      : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: tab === t ? c.onTint : c.muted,
                    fontSize: 14,
                    fontFamily: 'Manrope_600SemiBold',
                  }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Tab Content */}
          {error ? (
            <View className="flex-1 justify-center items-center" style={{ paddingBottom: 80 }}>
              <Ionicons name="warning-outline" size={48} color={c.error} />
              <Text
                className="text-base mt-3"
                style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
              >
                Couldn't load class data
              </Text>
              <Text
                className="text-sm mt-1 text-center px-8"
                style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
              >
                {error}
              </Text>
              <SlabButton
                label="Retry"
                onPress={load}
                style={{ marginTop: 16, minWidth: 140 }}
                accessibilityHint="Retry loading students and assignments"
              />
            </View>
          ) : tab === 'students' ? (
            <>
              <SlabButton
                label="Bulk Enroll Students"
                onPress={() => router.push(`/classes/${classId}/enroll` as any)}
                style={{ marginBottom: 16 }}
                accessibilityHint="Navigate to bulk enroll students"
              />
              {students.length === 0 ? (
                <View className="flex-1 justify-center items-center" style={{ paddingBottom: 80 }}>
                  <Ionicons name="people-outline" size={48} color={c.idle} />
                  <Text
                    className="text-base mt-3"
                    style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
                  >
                    No students enrolled
                  </Text>
                  <Text
                    className="text-sm mt-1 text-center px-8"
                    style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
                  >
                    Share the invite code with students so they can join this class.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={students}
                  keyExtractor={(item) => item.id}
                  renderItem={renderStudentItem}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 100 }}
                />
              )}
            </>
          ) : (
            <>
              <SlabButton
                label="Create Assignment"
                onPress={() => router.push('/assignments/create' as any)}
                style={{ marginBottom: 16 }}
                accessibilityHint="Navigate to create a new assignment"
              />
              {assignments.length === 0 ? (
                <View className="flex-1 justify-center items-center" style={{ paddingBottom: 80 }}>
                  <Ionicons name="document-text-outline" size={48} color={c.idle} />
                  <Text
                    className="text-base mt-3"
                    style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
                  >
                    No assignments yet
                  </Text>
                  <Text
                    className="text-sm mt-1 text-center px-8"
                    style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
                  >
                    Create an assignment to give your students conversation practice.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={assignments}
                  keyExtractor={(item) => item.id}
                  renderItem={renderAssignmentItem}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 100 }}
                />
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
