import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import ClassCard from '../../../components/school/ClassCard';
import { useSchoolStore } from '../../../stores/useSchoolStore';
import { useAuth } from '../../../hooks/useAuth';
import type { Classroom } from '../../../types';
import { Ui2InlineError } from '../../../components/ui2/Ui2InlineError';
import { loadErrorCopy, type ErrorCopy } from '../../../lib/error-copy';

export default function ClassListScreen() {
  const { c } = useUi2Theme();
  const router = useRouter();
  const { user } = useAuth();
  const { classrooms, loadTeacherData } = useSchoolStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorCopy | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      await loadTeacherData(user.id);
    } catch (err) {
      // Without this the screen said "No classes yet" during an outage — a
      // pilot coordinator's first impression being that their data is gone.
      console.error('Failed to load classes:', err);
      setError(loadErrorCopy(err, 'your classes'));
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
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-1 px-4 pt-2">
          <Text
            className="text-[28px] mb-4"
            style={{ fontFamily: 'Nunito_800ExtraBold', color: c.ink }}
            accessibilityRole="header"
          >
            My Classes
          </Text>

          <SlabButton
            label="Create Class"
            onPress={() => router.push('/classes/create' as any)}
            style={{ marginBottom: 20 }}
            accessibilityHint="Navigate to create a new class"
          />

          {loading ? (
            <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 32 }} />
          ) : error ? (
            <Ui2InlineError copy={error} onRetry={load} />
          ) : classrooms.length === 0 ? (
            <View className="flex-1 justify-center items-center" style={{ paddingBottom: 80 }}>
              <Ionicons name="school-outline" size={56} color={c.idle} />
              <Text
                className="text-lg mt-4"
                style={{ fontFamily: 'Nunito_600SemiBold', color: c.ink }}
              >
                No classes yet
              </Text>
              <Text
                className="text-sm mt-1 text-center px-8"
                style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}
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
    </View>
  );
}
