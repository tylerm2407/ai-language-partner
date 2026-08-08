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
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../../components/ui/GlassSurface';
import { GradientButton } from '../../../../components/ui/GradientButton';
import AssignmentCard from '../../../../components/school/AssignmentCard';
import { useSchoolStore } from '../../../../stores/useSchoolStore';
import {
  fetchClassroomStudents,
  fetchClassroomAssignments,
} from '../../../../lib/supabase-queries';
import type { Classroom, Assignment } from '../../../../types';
import { colors } from '../../../../config/theme';

interface StudentRowData {
  id: string;
  name: string;
  enrolledAt: string;
}

type Tab = 'students' | 'assignments';

export default function ClassDetailScreen() {
  const router = useRouter();
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
        <GlassSurface
          style={{ marginBottom: 10 }}
          innerStyle={{ padding: 14 }}
        >
          <View className="flex-row items-center">
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="person-outline" size={18} color="#C9CDD2" />
            </View>
            <View className="ml-3 flex-1">
              <Text
                className="text-base text-text-primary"
                style={{ fontFamily: 'Nunito_600SemiBold' }}
              >
                {item.name}
              </Text>
              <Text
                className="text-xs text-text-secondary"
                style={{ fontFamily: 'Nunito_400Regular' }}
              >
                Enrolled{' '}
                {new Date(item.enrolledAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#5C6166" />
          </View>
        </GlassSurface>
      </Pressable>
    ),
    [classId, router],
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
      <GradientBackground>
        <SafeAreaView className="flex-1 justify-center items-center">
          <ActivityIndicator color="#C9CDD2" size="large" />
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
            <Ionicons name="chevron-back" size={24} color="#C9CDD2" />
            <Text
              className="text-base text-primary ml-1"
              style={{ fontFamily: 'Nunito_600SemiBold' }}
            >
              Back
            </Text>
          </Pressable>

          <Text
            className="text-[28px] text-text-primary mb-2"
            style={{ fontFamily: 'Nunito_800ExtraBold' }}
            accessibilityRole="header"
          >
            {classroom?.name ?? 'Class'}
          </Text>

          {/* Invite Code */}
          {classroom?.inviteCode && (
            <GlassSurface
              style={{ marginBottom: 16 }}
              innerStyle={{
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text
                  className="text-xs text-text-secondary"
                  style={{ fontFamily: 'Nunito_500Medium' }}
                >
                  Invite Code
                </Text>
                <Text
                  className="text-lg text-primary"
                  style={{ fontFamily: 'Nunito_700Bold', letterSpacing: 2 }}
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
                    style={{ color: '#3FB950', fontSize: 12, fontFamily: 'Nunito_600SemiBold' }}
                  >
                    Copied
                  </Text>
                )}
                <Ionicons
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={20}
                  color={copied ? '#3FB950' : '#C9CDD2'}
                />
              </Pressable>
            </GlassSurface>
          )}

          {/* Segmented Control */}
          <View
            className="flex-row mb-4"
            style={{
              backgroundColor: colors.surface.cardAlt,
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
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: tab === t ? '#C9CDD2' : '#80868C',
                    fontSize: 14,
                    fontFamily: 'Nunito_600SemiBold',
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
              <Ionicons name="warning-outline" size={48} color="#F85149" />
              <Text
                className="text-base text-text-primary mt-3"
                style={{ fontFamily: 'Nunito_600SemiBold' }}
              >
                Couldn't load class data
              </Text>
              <Text
                className="text-sm text-text-secondary mt-1 text-center px-8"
                style={{ fontFamily: 'Nunito_400Regular' }}
              >
                {error}
              </Text>
              <GradientButton
                label="Retry"
                onPress={load}
                style={{ marginTop: 16, minWidth: 140 }}
                accessibilityHint="Retry loading students and assignments"
              />
            </View>
          ) : tab === 'students' ? (
            <>
              <GradientButton
                label="Bulk Enroll Students"
                onPress={() => router.push(`/classes/${classId}/enroll` as any)}
                style={{ marginBottom: 16 }}
                accessibilityHint="Navigate to bulk enroll students"
              />
              {students.length === 0 ? (
                <View className="flex-1 justify-center items-center" style={{ paddingBottom: 80 }}>
                  <Ionicons name="people-outline" size={48} color="#5C6166" />
                  <Text
                    className="text-base text-text-primary mt-3"
                    style={{ fontFamily: 'Nunito_600SemiBold' }}
                  >
                    No students enrolled
                  </Text>
                  <Text
                    className="text-sm text-text-secondary mt-1 text-center px-8"
                    style={{ fontFamily: 'Nunito_400Regular' }}
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
              <GradientButton
                label="Create Assignment"
                onPress={() => router.push('/assignments/create' as any)}
                style={{ marginBottom: 16 }}
                accessibilityHint="Navigate to create a new assignment"
              />
              {assignments.length === 0 ? (
                <View className="flex-1 justify-center items-center" style={{ paddingBottom: 80 }}>
                  <Ionicons name="document-text-outline" size={48} color="#5C6166" />
                  <Text
                    className="text-base text-text-primary mt-3"
                    style={{ fontFamily: 'Nunito_600SemiBold' }}
                  >
                    No assignments yet
                  </Text>
                  <Text
                    className="text-sm text-text-secondary mt-1 text-center px-8"
                    style={{ fontFamily: 'Nunito_400Regular' }}
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
    </GradientBackground>
  );
}
