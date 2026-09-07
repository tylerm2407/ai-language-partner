import { useState, useMemo } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '../../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../../../../components/ui2/SlabCard';
import { SlabButton } from '../../../../components/ui2/SlabButton';
import { Ui2Input } from '../../../../components/ui2/Ui2Input';
import { useUi2Theme } from '../../../../hooks/useUi2Theme';
import { callSchoolAction } from '../../../../lib/supabase-queries';

interface EnrollResult {
  email: string;
  success: boolean;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BulkEnrollScreen() {
  const { c } = useUi2Theme();
  const goBack = useSafeBack('/(teacher)');
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
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <View className="flex-1 px-4 pt-2">
          <Pressable
            onPress={() => goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center mb-4 min-h-11 -ml-1 pl-1"
          >
            <Ionicons name="chevron-back" size={24} color={c.primary} />
            <Text className="text-base ml-1" style={{ fontFamily: 'Nunito_600SemiBold', color: c.primary }}>Back</Text>
          </Pressable>

          <Text
            className="text-[28px] mb-2"
            style={{ fontFamily: 'Nunito_800ExtraBold', color: c.ink }}
            accessibilityRole="header"
          >
            Bulk Enroll Students
          </Text>
          <Text
            className="text-sm mb-4"
            style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}
          >
            Enter student email addresses, one per line
          </Text>

          {/* Email Input */}
          <Ui2Input
            containerStyle={{ marginBottom: 12 }}
            value={emailText}
            onChangeText={setEmailText}
            placeholder={'student1@school.edu\nstudent2@school.edu\nstudent3@school.edu'}
            multiline
            inputStyle={{ minHeight: 176, fontSize: 14 }}
            accessibilityLabel="Email addresses input"
          />

          {/* Counter */}
          <View className="flex-row items-center mb-4" style={{ gap: 12 }}>
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Ionicons name="checkmark-circle" size={16} color={c.green} />
              <Text style={{ color: c.green, fontSize: 13, fontFamily: 'Nunito_600SemiBold' }}>
                {validEmails.length} valid
              </Text>
            </View>
            {invalidEmails.length > 0 && (
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <Ionicons name="alert-circle" size={16} color={c.error} />
                <Text style={{ color: c.error, fontSize: 13, fontFamily: 'Nunito_600SemiBold' }}>
                  {invalidEmails.length} invalid
                </Text>
              </View>
            )}
          </View>

          <SlabButton
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
                    <Ionicons name="checkmark-circle" size={18} color={c.green} />
                    <Text style={{ color: c.green, fontSize: 14, fontFamily: 'Nunito_600SemiBold' }}>
                      {successCount} enrolled
                    </Text>
                  </View>
                )}
                {errorCount > 0 && (
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <Ionicons name="close-circle" size={18} color={c.error} />
                    <Text style={{ color: c.error, fontSize: 14, fontFamily: 'Nunito_600SemiBold' }}>
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
                  <SlabCard style={{ marginBottom: 6, padding: 10, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="close-circle" size={16} color={c.error} style={{ marginRight: 8 }} />
                    <View className="flex-1">
                      <Text className="text-sm" style={{ fontFamily: 'Nunito_500Medium', color: c.ink }}>{item.email}</Text>
                      <Text className="text-xs" style={{ color: c.error, fontFamily: 'Nunito_400Regular' }}>{item.error}</Text>
                    </View>
                  </SlabCard>
                )}
                ListEmptyComponent={null}
              />
            </>
          )}
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
