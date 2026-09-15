import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SlabButton } from '../../../components/ui2/SlabButton';
import AssignmentCard from '../../../components/school/AssignmentCard';
import { useSchoolStore } from '../../../stores/useSchoolStore';
import { useAuth } from '../../../hooks/useAuth';
import { fetchClassroomAssignments } from '../../../lib/supabase-queries';
import type { Assignment } from '../../../types';
import { Ui2InlineError } from '../../../components/ui2/Ui2InlineError';
import { loadErrorCopy, type ErrorCopy } from '../../../lib/error-copy';
import { useUi2Theme } from '../../../hooks/useUi2Theme';

export default function AssignmentsListScreen() {
  const { c } = useUi2Theme();
  const router = useRouter();
  const { user } = useAuth();
  const { loadTeacherData } = useSchoolStore();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState<ErrorCopy | null>(null);
  // One classroom failing used to be swallowed by `.catch(() => [])`, so the
  // screen rendered a partial list that looked complete. Tracked separately
  // from a total failure: a partial result is still worth showing.
  const [partial, setPartial] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    setPartial(false);
    try {
      await loadTeacherData(user.id);
      const currentClassrooms = useSchoolStore.getState().classrooms;
      const settled = await Promise.allSettled(
        currentClassrooms.map((c) => fetchClassroomAssignments(c.id)),
      );
      const failures = settled.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.error('Failed to load assignments for some classrooms:', failures);
        setPartial(true);
      }
      setAssignments(
        settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
      );
    } catch (err) {
      console.error('Failed to load assignments:', err);
      setError(loadErrorCopy(err, 'your assignments'));
    } finally {
      setLoading(false);
    }
  }, [loadTeacherData, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = useCallback(
    ({ item }: { item: Assignment }) => (
      <AssignmentCard
        assignment={item}
        onPress={() => router.push(`/assignments/${item.id}` as any)}
      />
    ),
    [router],
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-1 px-4 pt-2">
          <Text
            className="text-[28px] mb-4"
            style={{ fontFamily: 'Manrope_800ExtraBold', color: c.ink }}
            accessibilityRole="header"
          >
            Assignments
          </Text>

          <SlabButton
            label="Create Assignment"
            onPress={() => router.push('/assignments/create' as any)}
            style={{ marginBottom: 20 }}
            accessibilityHint="Navigate to create a new assignment"
          />

          {partial && !loading && !error ? (
            <Text className="text-sm mb-2" style={{ color: c.yellow }}>
              Some classes couldn&apos;t be loaded. Pull to try again.
            </Text>
          ) : null}
          {loading ? (
            <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 32 }} />
          ) : error ? (
            <Ui2InlineError copy={error} onRetry={load} />
          ) : assignments.length === 0 ? (
            <View className="flex-1 justify-center items-center" style={{ paddingBottom: 80 }}>
              <Ionicons name="document-text-outline" size={56} color={c.idle} />
              <Text
                className="text-lg mt-4"
                style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
              >
                No assignments yet
              </Text>
              <Text
                className="text-sm mt-1 text-center px-8"
                style={{ fontFamily: 'Manrope_400Regular', color: c.muted }}
              >
                Create your first assignment to give students conversation practice.
              </Text>
            </View>
          ) : (
            <FlatList
              data={assignments}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
