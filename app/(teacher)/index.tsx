import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { GlassSurface } from '../../components/ui/GlassSurface';
import { useSchoolStore } from '../../stores/useSchoolStore';
import { useAppStore } from '../../stores/useAppStore';
import { useAuth } from '../../hooks/useAuth';
import { useTeacherDashboard } from '../../hooks/useTeacherDashboard';

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
  const router = useRouter();
  const { user } = useAuth();
  const { organization, classrooms, loadTeacherData } = useSchoolStore();
  const { profile } = useAppStore();

  const {
    totalStudents,
    pendingSubmissions,
    averageCompletionRate,
    upcomingAssignments,
    recentSubmissions,
    loading,
    refresh,
  } = useTeacherDashboard(user?.id);

  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    if (user?.id && !initialLoaded) {
      loadTeacherData(user.id).finally(() => setInitialLoaded(true));
    }
  }, [user?.id, initialLoaded, loadTeacherData]);

  const stats: QuickStat[] = [
    {
      label: 'Active Students',
      value: String(totalStudents),
      icon: 'people-outline',
      color: '#A855F7',
    },
    {
      label: 'Pending Grades',
      value: String(pendingSubmissions),
      icon: 'document-text-outline',
      color: '#F59E0B',
    },
    {
      label: 'Avg Completion',
      value: averageCompletionRate > 0 ? `${Math.round(averageCompletionRate * 100)}%` : '—',
      icon: 'stats-chart-outline',
      color: '#22C55E',
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
      <GradientBackground>
        <SafeAreaView className="flex-1 justify-center items-center px-6">
          <Ionicons name="school-outline" size={64} color="#64748B" />
          <Text
            className="text-xl text-text-primary mt-4 text-center"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Not linked to a school
          </Text>
          <Text className="text-base text-text-secondary mt-2 text-center">
            Contact your school administrator to get set up as a teacher.
          </Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#38BDF8" />
          }
        >
          {/* Header */}
          <Text
            className="text-[28px] text-text-primary mb-1"
            style={{ fontFamily: 'Inter_700Bold' }}
            accessibilityRole="header"
          >
            Dashboard
          </Text>
          <Text
            className="text-base text-text-secondary mb-6"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            {organization.name}
          </Text>

          {loading ? (
            <ActivityIndicator color="#38BDF8" size="large" style={{ marginTop: 32 }} />
          ) : (
            <>
              {/* Quick Stats */}
              <View className="flex-row mb-6" style={{ gap: 10 }}>
                {stats.map((stat) => (
                  <GlassSurface
                    key={stat.label}
                    style={{ flex: 1 }}
                    innerStyle={{ padding: 14, alignItems: 'center' }}
                    accessibilityLabel={`${stat.label}: ${stat.value}`}
                    accessibilityRole="summary"
                  >
                    <Ionicons name={stat.icon} size={22} color={stat.color} />
                    <Text
                      className="text-xl text-text-primary mt-2"
                      style={{ fontFamily: 'Inter_700Bold' }}
                    >
                      {stat.value}
                    </Text>
                    <Text
                      className="text-xs text-text-secondary mt-1 text-center"
                      style={{ fontFamily: 'Inter_500Medium' }}
                      numberOfLines={1}
                    >
                      {stat.label}
                    </Text>
                  </GlassSurface>
                ))}
              </View>

              {/* Upcoming Due Dates */}
              <Text
                className="text-xl text-text-primary mb-3"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                Upcoming
              </Text>
              {upcoming.length === 0 ? (
                <GlassSurface
                  style={{ marginBottom: 16 }}
                  innerStyle={{ padding: 20, alignItems: 'center' }}
                >
                  <Ionicons name="calendar-outline" size={28} color="#64748B" />
                  <Text
                    className="text-sm text-text-secondary mt-2"
                    style={{ fontFamily: 'Inter_400Regular' }}
                  >
                    No upcoming assignments
                  </Text>
                </GlassSurface>
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
                    <GlassSurface
                      style={{ marginBottom: 10 }}
                      innerStyle={{ padding: 14 }}
                    >
                      <Text
                        className="text-base text-text-primary"
                        style={{ fontFamily: 'Inter_600SemiBold' }}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <View
                        className="flex-row items-center mt-2"
                        style={{ gap: 12 }}
                      >
                        <Text
                          className="text-xs text-text-secondary"
                          style={{ fontFamily: 'Inter_500Medium' }}
                        >
                          {item.classroomName}
                        </Text>
                        {item.dueAt && (
                          <Text
                            className="text-xs"
                            style={{
                              fontFamily: 'Inter_500Medium',
                              color: '#F59E0B',
                            }}
                          >
                            {formatRelativeTime(item.dueAt)}
                          </Text>
                        )}
                        <Text
                          className="text-xs text-text-secondary"
                          style={{ fontFamily: 'Inter_500Medium' }}
                        >
                          {item.submissionCount}/{item.totalStudents} submitted
                        </Text>
                      </View>
                    </GlassSurface>
                  </Pressable>
                ))
              )}

              {/* Recent Activity */}
              <Text
                className="text-xl text-text-primary mt-4 mb-3"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                Recent Activity
              </Text>
              {activity.length === 0 ? (
                <GlassSurface
                  style={{ marginBottom: 16 }}
                  innerStyle={{ padding: 20, alignItems: 'center' }}
                >
                  <Ionicons name="pulse-outline" size={28} color="#64748B" />
                  <Text
                    className="text-sm text-text-secondary mt-2"
                    style={{ fontFamily: 'Inter_400Regular' }}
                  >
                    No recent activity
                  </Text>
                </GlassSurface>
              ) : (
                activity.slice(0, 5).map((event) => (
                  <View
                    key={event.id}
                    className="flex-row items-center mb-3"
                    style={{ gap: 10 }}
                  >
                    <Ionicons name={event.icon} size={18} color="#64748B" />
                    <Text
                      className="text-sm text-text-primary flex-1"
                      style={{ fontFamily: 'Inter_400Regular' }}
                      numberOfLines={1}
                    >
                      {event.text}
                    </Text>
                    <Text
                      className="text-xs text-text-secondary"
                      style={{ fontFamily: 'Inter_500Medium' }}
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
    </GradientBackground>
  );
}
