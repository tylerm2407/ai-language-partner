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

export default function AssignmentsListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { classrooms, loadTeacherData } = useSchoolStore();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await loadTeacherData(user.id);
      const currentClassrooms = useSchoolStore.getState().classrooms;
      const allAssignmentArrays = await Promise.all(
        currentClassrooms.map((c) => fetchClassroomAssignments(c.id).catch(() => []))
      );
      setAssignments(allAssignmentArrays.flat());
    } catch (err) {
      console.error('Failed to load assignments:', err);
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
            style={{ fontFamily: 'Inter_700Bold' }}
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

          {loading ? (
            <ActivityIndicator color="#38BDF8" size="large" style={{ marginTop: 32 }} />
          ) : assignments.length === 0 ? (
            <View className="flex-1 justify-center items-center" style={{ paddingBottom: 80 }}>
              <Ionicons name="document-text-outline" size={56} color="#64748B" />
              <Text
                className="text-lg text-text-primary mt-4"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                No assignments yet
              </Text>
              <Text
                className="text-sm text-text-secondary mt-1 text-center px-8"
                style={{ fontFamily: 'Inter_400Regular' }}
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
