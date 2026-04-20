import { useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { GradientBackground } from '../../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../../components/ui/GlassSurface';
import { GradientButton } from '../../../../components/ui/GradientButton';
import { callSchoolAction } from '../../../../lib/supabase-queries';

interface EnrollResult {
  email: string;
  success: boolean;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BulkEnrollScreen() {
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const [emailText, setEmailText] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [results, setResults] = useState<EnrollResult[] | null>(null);

  const parsedEmails = useMemo(() => {
    const lines = emailText
      .split('\n')
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l.length > 0);
    // Deduplicate
    return [...new Set(lines)];
  }, [emailText]);

  const validEmails = useMemo(
    () => parsedEmails.filter((e) => EMAIL_REGEX.test(e)),
    [parsedEmails]
  );

  const invalidEmails = useMemo(
    () => parsedEmails.filter((e) => !EMAIL_REGEX.test(e)),
    [parsedEmails]
  );

  const handleEnroll = async () => {
    if (validEmails.length === 0 || !classId) return;
    setEnrolling(true);
    setResults(null);
    try {
      const response = await callSchoolAction('bulk_enroll', {
        classroomId: classId,
        students: validEmails.map((email) => ({ email })),
      });
      // Response shape: { enrolled: [...], errors: [...] }
      const enrolledSet = new Set((response.enrolled ?? []).map((e: any) => e.email?.toLowerCase()));
      const errorMap = new Map<string, string>();
      (response.errors ?? []).forEach((e: any) => {
        errorMap.set(e.email?.toLowerCase(), e.reason ?? 'Unknown error');
      });

      const resultList: EnrollResult[] = validEmails.map((email) => ({
        email,
        success: enrolledSet.has(email),
        error: errorMap.get(email),
      }));
      setResults(resultList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Enrollment failed';
      setResults(validEmails.map((email) => ({ email, success: false, error: message })));
    } finally {
      setEnrolling(false);
    }
  };

  const successCount = results?.filter((r) => r.success).length ?? 0;
  const errorCount = results?.filter((r) => !r.success).length ?? 0;

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-1 px-4 pt-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center mb-4"
          >
            <Ionicons name="chevron-back" size={24} color="#38BDF8" />
            <Text className="text-base text-primary ml-1" style={{ fontFamily: 'Inter_600SemiBold' }}>Back</Text>
          </Pressable>

          <Text
            className="text-[28px] text-text-primary mb-2"
            style={{ fontFamily: 'Inter_700Bold' }}
            accessibilityRole="header"
          >
            Bulk Enroll Students
          </Text>
          <Text
            className="text-sm text-text-secondary mb-4"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            Enter student email addresses, one per line
          </Text>

          {/* Email Input */}
          <GlassSurface style={{ marginBottom: 12 }} innerStyle={{ padding: 0 }}>
            <TextInput
              value={emailText}
              onChangeText={setEmailText}
              placeholder={'student1@school.edu\nstudent2@school.edu\nstudent3@school.edu'}
              placeholderTextColor="#64748B"
              multiline
              style={{
                color: '#F1F5F9',
                fontSize: 14,
                fontFamily: 'Inter_400Regular',
                padding: 14,
                minHeight: 200,
                textAlignVertical: 'top',
              }}
              accessibilityLabel="Email addresses input"
            />
          </GlassSurface>

          {/* Counter */}
          <View className="flex-row items-center mb-4" style={{ gap: 12 }}>
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <Text style={{ color: '#22C55E', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>
                {validEmails.length} valid
              </Text>
            </View>
            {invalidEmails.length > 0 && (
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>
                  {invalidEmails.length} invalid
                </Text>
              </View>
            )}
          </View>

          <GradientButton
            label={enrolling ? 'Enrolling...' : `Enroll ${validEmails.length} Students`}
            onPress={handleEnroll}
            loading={enrolling}
            disabled={validEmails.length === 0 || enrolling}
            style={{ marginBottom: 20 }}
            accessibilityHint="Enroll all valid email addresses"
          />

          {/* Results */}
          {results && (
            <>
              <View className="flex-row items-center mb-3" style={{ gap: 12 }}>
                {successCount > 0 && (
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                    <Text style={{ color: '#22C55E', fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                      {successCount} enrolled
                    </Text>
                  </View>
                )}
                {errorCount > 0 && (
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                    <Text style={{ color: '#EF4444', fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                      {errorCount} failed
                    </Text>
                  </View>
                )}
              </View>

              <FlatList
                data={results.filter((r) => !r.success)}
                keyExtractor={(item) => item.email}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                renderItem={({ item }) => (
                  <GlassSurface style={{ marginBottom: 6 }} innerStyle={{ padding: 10, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="close-circle" size={16} color="#EF4444" style={{ marginRight: 8 }} />
                    <View className="flex-1">
                      <Text className="text-sm text-text-primary" style={{ fontFamily: 'Inter_500Medium' }}>{item.email}</Text>
                      <Text className="text-xs" style={{ color: '#EF4444', fontFamily: 'Inter_400Regular' }}>{item.error}</Text>
                    </View>
                  </GlassSurface>
                )}
                ListEmptyComponent={null}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}
