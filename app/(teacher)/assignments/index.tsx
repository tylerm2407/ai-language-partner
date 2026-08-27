import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GradientButton } from '../../../components/ui/GradientButton';
import AssignmentCard from '../../../components/school/AssignmentCard';
import { useSchoolStore } from '../../../stores/useSchoolStore';
import { useAuth } from '../../../hooks/useAuth';
import { fetchClassroomAssignments } from '../../../lib/supabase-queries';
import type { Assignment } from '../../../types';
import { InlineError } from '../../../components/ui/InlineError';
import { loadErrorCopy, type ErrorCopy } from '../../../lib/error-copy';

export default function AssignmentsListScreen() {
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
  }, []);

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
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-1 px-4 pt-2">
          <Text
            className="text-[28px] text-text-primary mb-4"
            style={{ fontFamily: 'Nunito_800ExtraBold' }}
            accessibilityRole="header"
          >
            Assignments
          </Text>

          <GradientButton
            label="Create Assignment"
            onPress={() => router.push('/assignments/create' as any)}
            style={{ marginBottom: 20 }}
            accessibilityHint="Navigate to create a new assignment"
          />

          {partial && !loading && !error ? (
            <Text className="text-sm text-warning mb-2">
              Some classes couldn&apos;t be loaded. Pull to try again.
            </Text>
          ) : null}
          {loading ? (
            <ActivityIndicator color="#818CF8" size="large" style={{ marginTop: 32 }} />
          ) : error ? (
            <InlineError copy={error} onRetry={load} />
          ) : assignments.length === 0 ? (
            <View className="flex-1 justify-center items-center" style={{ paddingBottom: 80 }}>
              <Ionicons name="document-text-outline" size={56} color="#64748B" />
              <Text
                className="text-lg text-text-primary mt-4"
                style={{ fontFamily: 'Nunito_600SemiBold' }}
              >
                No assignments yet
              </Text>
              <Text
                className="text-sm text-text-secondary mt-1 text-center px-8"
                style={{ fontFamily: 'Nunito_400Regular' }}
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
    </GradientBackground>
  );
}
