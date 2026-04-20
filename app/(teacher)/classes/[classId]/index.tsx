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
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../../components/ui/GlassSurface';
import { GradientButton } from '../../../../components/ui/GradientButton';
import AssignmentCard from '../../../../components/school/AssignmentCard';
import { useSchoolStore } from '../../../../stores/useSchoolStore';
import type { Classroom, Assignment } from '../../../../types';

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
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<StudentRowData[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    const found = classrooms.find((c) => c.id === classId) ?? null;
    setClassroom(found);
    // TODO: fetch students and assignments for this class from API
    setLoading(false);
  }, [classId, classrooms]);

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
                backgroundColor: 'rgba(168, 85, 247, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="person-outline" size={18} color="#A855F7" />
            </View>
            <View className="ml-3 flex-1">
              <Text
                className="text-base text-text-primary"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                {item.name}
              </Text>
              <Text
                className="text-xs text-text-secondary"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                Enrolled{' '}
                {new Date(item.enrolledAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
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
                  style={{ fontFamily: 'Inter_500Medium' }}
                >
                  Invite Code
                </Text>
                <Text
                  className="text-lg text-primary"
                  style={{ fontFamily: 'Inter_700Bold', letterSpacing: 2 }}
                >
                  {classroom.inviteCode}
                </Text>
              </View>
              <Ionicons name="copy-outline" size={20} color="#38BDF8" />
            </GlassSurface>
          )}

          {/* Segmented Control */}
          <View
            className="flex-row mb-4"
            style={{
              backgroundColor: 'rgba(30, 35, 50, 0.6)',
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
                      ? 'rgba(168, 85, 247, 0.2)'
                      : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: tab === t ? '#A855F7' : '#94A3B8',
                    fontSize: 14,
                    fontFamily: 'Inter_600SemiBold',
                  }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Tab Content */}
          {tab === 'students' ? (
            <>
              <GradientButton
                label="Bulk Enroll Students"
                onPress={() => router.push(`/classes/${classId}/enroll` as any)}
                style={{ marginBottom: 16 }}
                accessibilityHint="Navigate to bulk enroll students"
              />
              {students.length === 0 ? (
                <View className="flex-1 justify-center items-center" style={{ paddingBottom: 80 }}>
                  <Ionicons name="people-outline" size={48} color="#64748B" />
                  <Text
                    className="text-base text-text-primary mt-3"
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                  >
                    No students enrolled
                  </Text>
                  <Text
                    className="text-sm text-text-secondary mt-1 text-center px-8"
                    style={{ fontFamily: 'Inter_400Regular' }}
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
                  <Ionicons name="document-text-outline" size={48} color="#64748B" />
                  <Text
                    className="text-base text-text-primary mt-3"
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                  >
                    No assignments yet
                  </Text>
                  <Text
                    className="text-sm text-text-secondary mt-1 text-center px-8"
                    style={{ fontFamily: 'Inter_400Regular' }}
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
