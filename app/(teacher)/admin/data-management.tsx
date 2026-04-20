import { useState } from 'react';
import { View, Text, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { GlassSurface } from '../../../components/ui/GlassSurface';
import { GradientButton } from '../../../components/ui/GradientButton';
import { useSchoolStore } from '../../../stores/useSchoolStore';
import { callSchoolAdminAction } from '../../../lib/supabase-queries';

export default function DataManagementScreen() {
  const router = useRouter();
  const { organization } = useSchoolStore();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = async () => {
    if (!organization?.id) return;
    setExporting(true);
    try {
      await callSchoolAdminAction('export-org-data', { organizationId: organization.id });
      setExportSuccess(true);
      Alert.alert('Export Complete', 'Organization data has been exported successfully. Check your email for the download link.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      Alert.alert('Error', message);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!organization?.id) return;
    if (confirmText !== organization.name) {
      Alert.alert('Error', 'Please type the organization name exactly to confirm.');
      return;
    }

    Alert.alert(
      'Confirm Permanent Deletion',
      'This action cannot be undone. All organization data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const result = await callSchoolAdminAction('purge-org-data', {
                organizationId: organization.id,
                confirmationToken: `CONFIRM-DELETE-${organization.id}`,
              });
              Alert.alert('Deletion Complete', `All data has been purged.\n\nSummary:\n- ${result.summary?.messages ?? 0} messages\n- ${result.summary?.sessions ?? 0} sessions\n- ${result.summary?.submissions ?? 0} submissions\n- ${result.summary?.assignments ?? 0} assignments`, [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Deletion failed';
              Alert.alert('Error', message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView className="flex-1 px-4 pt-2" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
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
            className="text-[28px] text-text-primary mb-6"
            style={{ fontFamily: 'Inter_700Bold' }}
            accessibilityRole="header"
          >
            Data Management
          </Text>

          {/* Export Section */}
          <Text className="text-xl text-text-primary mb-3" style={{ fontFamily: 'Inter_600SemiBold' }}>
            Export All Data
          </Text>
          <GlassSurface style={{ marginBottom: 24 }} innerStyle={{ padding: 16 }}>
            <Text className="text-sm text-text-secondary mb-4" style={{ fontFamily: 'Inter_400Regular' }}>
              Download a complete export of all organization data including students, assignments, submissions, and chat transcripts in JSON format.
            </Text>
            <GradientButton
              label={exporting ? 'Exporting...' : 'Export Organization Data'}
              onPress={handleExport}
              loading={exporting}
              accessibilityHint="Export all organization data"
            />
            {exportSuccess && (
              <View className="flex-row items-center mt-3" style={{ gap: 6 }}>
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                <Text style={{ color: '#22C55E', fontSize: 13, fontFamily: 'Inter_500Medium' }}>
                  Export completed successfully
                </Text>
              </View>
            )}
          </GlassSurface>

          {/* Danger Zone */}
          <Text className="text-xl mb-3" style={{ fontFamily: 'Inter_600SemiBold', color: '#EF4444' }}>
            Danger Zone
          </Text>
          <GlassSurface
            style={{ marginBottom: 16, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}
            innerStyle={{ padding: 16 }}
          >
            <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
              <Ionicons name="warning-outline" size={20} color="#EF4444" />
              <Text className="text-base text-text-primary" style={{ fontFamily: 'Inter_600SemiBold' }}>
                Permanently Delete All Data
              </Text>
            </View>
            <Text className="text-sm text-text-secondary mb-4" style={{ fontFamily: 'Inter_400Regular' }}>
              This will permanently delete all organization data including classrooms, enrollments, assignments, submissions, and chat messages. This action cannot be undone.
            </Text>

            <Text className="text-sm text-text-secondary mb-2" style={{ fontFamily: 'Inter_500Medium' }}>
              Type "{organization?.name}" to confirm:
            </Text>
            <GlassSurface style={{ marginBottom: 16 }} innerStyle={{ padding: 0 }}>
              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder="Organization name"
                placeholderTextColor="#64748B"
                style={{
                  color: '#F1F5F9',
                  fontSize: 15,
                  fontFamily: 'Inter_400Regular',
                  padding: 14,
                }}
                accessibilityLabel="Confirmation input"
              />
            </GlassSurface>

            <Pressable
              onPress={handleDelete}
              disabled={deleting || confirmText !== organization?.name}
              style={{
                backgroundColor: confirmText === organization?.name ? '#EF4444' : 'rgba(239, 68, 68, 0.3)',
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                opacity: deleting ? 0.6 : 1,
              }}
              accessibilityRole="button"
              accessibilityLabel="Permanently delete all data"
            >
              {deleting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' }}>
                  Permanently Delete
                </Text>
              )}
            </Pressable>
          </GlassSurface>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
