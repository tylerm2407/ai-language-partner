import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '../../../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../../../components/ui/GlassSurface';
import StatusBadge from '../../../../../components/school/StatusBadge';
import type { SubmissionStatus } from '../../../../../types';

interface StudentInfo {
  id: string;
  name: string;
  enrolledAt: string;
}

interface SubmissionRow {
  id: string;
  assignmentTitle: string;
  status: SubmissionStatus;
  score: number | null;
  submittedAt: string | null;
}

export default function StudentProgressScreen() {
  const router = useRouter();
  const { classId, studentId } = useLocalSearchParams<{
    classId: string;
    studentId: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    // TODO: fetch student info and submissions from API
    setLoading(false);
  }, [classId, studentId]);

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
        <ScrollView
          className="flex-1 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
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
            className="text-[28px] text-text-primary mb-4"
            style={{ fontFamily: 'Inter_700Bold' }}
            accessibilityRole="header"
          >
            {student?.name ?? 'Student'}
          </Text>

          {/* Student Info Card */}
          <GlassSurface
            style={{ marginBottom: 20 }}
            innerStyle={{ padding: 16 }}
          >
            <View className="flex-row items-center">
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="person" size={24} color="#A855F7" />
              </View>
              <View className="ml-4">
                <Text
                  className="text-lg text-text-primary"
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                >
                  {student?.name ?? 'Unknown'}
                </Text>
                <Text
                  className="text-sm text-text-secondary"
                  style={{ fontFamily: 'Inter_400Regular' }}
                >
                  Enrolled{' '}
                  {student?.enrolledAt
                    ? new Date(student.enrolledAt).toLocaleDateString(
                        undefined,
                        { month: 'long', day: 'numeric', year: 'numeric' },
                      )
                    : '—'}
                </Text>
              </View>
            </View>
          </GlassSurface>

          {/* Assignment History */}
          <Text
            className="text-xl text-text-primary mb-3"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Assignment History
          </Text>

          {submissions.length === 0 ? (
            <GlassSurface
              style={{ marginBottom: 16 }}
              innerStyle={{ padding: 20, alignItems: 'center' }}
            >
              <Ionicons name="document-text-outline" size={32} color="#64748B" />
              <Text
                className="text-sm text-text-secondary mt-2"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                No submissions yet
              </Text>
            </GlassSurface>
          ) : (
            submissions.map((sub) => (
              <GlassSurface
                key={sub.id}
                style={{ marginBottom: 10 }}
                innerStyle={{ padding: 14 }}
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text
                    className="text-base text-text-primary flex-1 mr-2"
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                    numberOfLines={1}
                  >
                    {sub.assignmentTitle}
                  </Text>
                  <StatusBadge status={sub.status} size="small" />
                </View>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  {sub.score !== null && (
                    <Text
                      style={{
                        color: '#22C55E',
                        fontSize: 13,
                        fontFamily: 'Inter_600SemiBold',
                      }}
                    >
                      {sub.score}/100
                    </Text>
                  )}
                  {sub.submittedAt && (
                    <Text
                      className="text-xs text-text-secondary"
                      style={{ fontFamily: 'Inter_400Regular' }}
                    >
                      {new Date(sub.submittedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  )}
                </View>
              </GlassSurface>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
