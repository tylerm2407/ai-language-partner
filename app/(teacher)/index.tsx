import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../../components/ui2/SlabCard';
import { useSchoolStore } from '../../stores/useSchoolStore';
import { useAuth } from '../../hooks/useAuth';
import { useTeacherDashboard } from '../../hooks/useTeacherDashboard';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface QuickStat {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface UpcomingAssignment {
  id: string;
  title: string;
  classroomName: string;
  dueAt: string | null;
  submissionCount: number;
  totalStudents: number;
}

interface ActivityEvent {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  timestamp: string;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = date - now;
  const absDiff = Math.abs(diff);
  if (absDiff < 60 * 1000) return 'Just now';
  if (absDiff < 60 * 60 * 1000) {
    const mins = Math.floor(absDiff / (60 * 1000));
    return diff > 0 ? `In ${mins}m` : `${mins}m ago`;
  }
  if (absDiff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(absDiff / (60 * 60 * 1000));
    return diff > 0 ? `In ${hours}h` : `${hours}h ago`;
  }
  const days = Math.floor(absDiff / (24 * 60 * 60 * 1000));
  return diff > 0 ? `In ${days}d` : `${days}d ago`;
}

export default function TeacherDashboardScreen() {
  const { c } = useUi2Theme();
  const router = useRouter();
  const { user } = useAuth();
  const { organization, classrooms, loadTeacherData } = useSchoolStore();

  const {
    totalStudents,
    pendingSubmissions,
    averageCompletionRate,
    upcomingAssignments,
    recentSubmissions,
    loading,
    error,
    refresh,
  } = useTeacherDashboard(user?.id);

  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    if (user?.id && !initialLoaded) {
      loadTeacherData(user.id)
        .catch((err) => console.error('[teacher] dashboard load failed:', err))
        .finally(() => setInitialLoaded(true));
    }
  }, [user?.id, initialLoaded, loadTeacherData]);

  const stats: QuickStat[] = [
    {
      label: 'Active Students',
      value: String(totalStudents),
      icon: 'people-outline',
      color: c.primary,
    },
    {
      label: 'Pending Grades',
      value: String(pendingSubmissions),
      icon: 'document-text-outline',
      color: c.yellow,
    },
    {
      label: 'Avg Completion',
      value: averageCompletionRate > 0 ? `${Math.round(averageCompletionRate * 100)}%` : '—',
      icon: 'stats-chart-outline',
      color: c.green,
    },
  ];

  const upcoming: UpcomingAssignment[] = upcomingAssignments.map((a) => {
    const classroom = classrooms.find((c) => c.id === a.classroomId);
    return {
      id: a.id,
      title: a.title,
      classroomName: classroom?.name ?? 'Unknown',
      dueAt: a.dueAt,
      submissionCount: 0,
      totalStudents: classroom?.studentCount ?? 0,
    };
  });

  const activity: ActivityEvent[] = recentSubmissions.map((s) => ({
    id: s.id,
    icon: s.status === 'graded' ? 'checkmark-circle-outline' : 'document-text-outline',
    text: `${s.studentName ?? 'Student'} — ${s.status}`,
    timestamp: s.submittedAt ?? s.startedAt ?? new Date().toISOString(),
  }));

  if (!organization) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView className="flex-1 justify-center items-center px-6">
          <Ionicons name="school-outline" size={64} color={c.idle} />
          <Text
            className="text-xl mt-4 text-center"
            style={{ fontFamily: 'Nunito_600SemiBold', color: c.ink }}
          >
            Not linked to a school
          </Text>
          <Text className="text-base mt-2 text-center" style={{ color: c.muted }}>
            Contact your school administrator to get set up as a teacher.
          </Text>
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
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.primary} />
          }
        >
          {/* Header */}
          <Text
            className="text-[28px] mb-1"
            style={{ fontFamily: 'Nunito_800ExtraBold', color: c.ink }}
            accessibilityRole="header"
          >
            Dashboard
          </Text>
          <Text
            className="text-base mb-6"
            style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}
          >
            {organization.name}
          </Text>

          {loading ? (
            <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 32 }} />
          ) : (
            <>
              {/* Load Error */}
              {error && (
                <SlabCard
                  style={{ marginBottom: 16, padding: 14, flexDirection: 'row', alignItems: 'center' }}
                >
                  <Ionicons name="warning-outline" size={18} color={c.yellow} />
                  <Text
                    className="text-sm flex-1 ml-2"
                    style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}
                  >
                    {error}
                  </Text>
                  <Pressable
                    onPress={refresh}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading dashboard"
                    style={{ paddingVertical: 6, paddingHorizontal: 12 }}
                  >
                    <Text
                      style={{ color: c.primary, fontSize: 13, fontFamily: 'Nunito_600SemiBold' }}
                    >
                      Retry
                    </Text>
                  </Pressable>
                </SlabCard>
              )}

              {/* Quick Stats */}
              <View className="flex-row mb-6" style={{ gap: 10 }}>
                {stats.map((stat) => (
                  <SlabCard
                    key={stat.label}
                    style={{ flex: 1, padding: 14, alignItems: 'center' }}
                    accessibilityLabel={`${stat.label}: ${stat.value}`}
                    accessibilityRole="summary"
                  >
                    <Ionicons name={stat.icon} size={22} color={stat.color} />
                    <Text
                      className="text-xl mt-2"
                      style={{ fontFamily: 'Nunito_700Bold', color: c.ink }}
                    >
                      {stat.value}
                    </Text>
                    <Text
                      className="text-xs mt-1 text-center"
                      style={{ fontFamily: 'Nunito_500Medium', color: c.muted }}
                      numberOfLines={1}
                    >
                      {stat.label}
                    </Text>
                  </SlabCard>
                ))}
              </View>

              {/* Upcoming Due Dates */}
              <Text
                className="text-xl mb-3"
                style={{ fontFamily: 'Nunito_600SemiBold', color: c.ink }}
              >
                Upcoming
              </Text>
              {upcoming.length === 0 ? (
                <SlabCard style={{ marginBottom: 16, padding: 20, alignItems: 'center' }}>
                  <Ionicons name="calendar-outline" size={28} color={c.idle} />
                  <Text
                    className="text-sm mt-2"
                    style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}
                  >
                    No upcoming assignments
                  </Text>
                </SlabCard>
              ) : (
                upcoming.slice(0, 3).map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      router.push(`/assignments/${item.id}` as any)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Assignment: ${item.title}`}
                  >
                    <SlabCard style={{ marginBottom: 10, padding: 14 }}>
                      <Text
                        className="text-base"
                        style={{ fontFamily: 'Nunito_600SemiBold', color: c.ink }}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <View
                        className="flex-row items-center mt-2"
                        style={{ gap: 12 }}
                      >
                        <Text
                          className="text-xs"
                          style={{ fontFamily: 'Nunito_500Medium', color: c.muted }}
                        >
                          {item.classroomName}
                        </Text>
                        {item.dueAt && (
                          <Text
                            className="text-xs"
                            style={{
                              fontFamily: 'Nunito_500Medium',
                              color: c.yellow,
                            }}
                          >
                            {formatRelativeTime(item.dueAt)}
                          </Text>
                        )}
                        <Text
                          className="text-xs"
                          style={{ fontFamily: 'Nunito_500Medium', color: c.muted }}
                        >
                          {item.submissionCount}/{item.totalStudents} submitted
                        </Text>
                      </View>
                    </SlabCard>
                  </Pressable>
                ))
              )}

              {/* Recent Activity */}
              <Text
                className="text-xl mt-4 mb-3"
                style={{ fontFamily: 'Nunito_600SemiBold', color: c.ink }}
              >
                Recent Activity
              </Text>
              {activity.length === 0 ? (
                <SlabCard style={{ marginBottom: 16, padding: 20, alignItems: 'center' }}>
                  <Ionicons name="pulse-outline" size={28} color={c.idle} />
                  <Text
                    className="text-sm mt-2"
                    style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}
                  >
                    No recent activity
                  </Text>
                </SlabCard>
              ) : (
                activity.slice(0, 5).map((event) => (
                  <View
                    key={event.id}
                    className="flex-row items-center mb-3"
                    style={{ gap: 10 }}
                  >
                    <Ionicons name={event.icon} size={18} color={c.idle} />
                    <Text
                      className="text-sm flex-1"
                      style={{ fontFamily: 'Nunito_400Regular', color: c.ink }}
                      numberOfLines={1}
                    >
                      {event.text}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ fontFamily: 'Nunito_500Medium', color: c.muted }}
                    >
                      {formatRelativeTime(event.timestamp)}
                    </Text>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
