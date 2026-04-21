import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GradientButton } from '../../../components/ui/GradientButton';
import ClassCard from '../../../components/school/ClassCard';
import { useSchoolStore } from '../../../stores/useSchoolStore';
import { useAuth } from '../../../hooks/useAuth';
import type { Classroom } from '../../../types';

export default function ClassListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { classrooms, loadTeacherData } = useSchoolStore();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await loadTeacherData(user.id);
    } catch (err) {
      console.error('Failed to load classes:', err);
    } finally {
      setLoading(false);
    }
  }, [loadTeacherData, user?.id]);

  useEffect(() => {
    load();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Classroom }) => (
      <ClassCard
        classroom={item}
        onPress={() => router.push(`/classes/${item.id}` as any)}
        showStudentCount
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
            My Classes
          </Text>

          <GradientButton
            label="Create Class"
            onPress={() => router.push('/classes/create' as any)}
            style={{ marginBottom: 20 }}
            accessibilityHint="Navigate to create a new class"
          />

          {loading ? (
            <ActivityIndicator color="#38BDF8" size="large" style={{ marginTop: 32 }} />
          ) : classrooms.length === 0 ? (
            <View className="flex-1 justify-center items-center" style={{ paddingBottom: 80 }}>
              <Ionicons name="school-outline" size={56} color="#64748B" />
              <Text
                className="text-lg text-text-primary mt-4"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                No classes yet
              </Text>
              <Text
                className="text-sm text-text-secondary mt-1 text-center px-8"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                Create your first class to start assigning conversation practice to students.
              </Text>
            </View>
          ) : (
            <FlatList
              data={classrooms}
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
