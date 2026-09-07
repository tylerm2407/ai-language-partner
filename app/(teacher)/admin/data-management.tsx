import { useState } from 'react';
import { View, Text, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Pressable, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSafeBack } from '../../../hooks/useSafeBack';
import * as Clipboard from 'expo-clipboard';
import { haptic } from '../../../lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { Ui2Input } from '../../../components/ui2/Ui2Input';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { useSchoolStore } from '../../../stores/useSchoolStore';
import { callSchoolAdminAction } from '../../../lib/supabase-queries';

export default function DataManagementScreen() {
  const { c } = useUi2Theme();
  const goBack = useSafeBack('/(teacher)');
  const { organization } = useSchoolStore();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [exportResult, setExportResult] = useState<Record<string, unknown> | null>(null);
  const [copiedExport, setCopiedExport] = useState(false);

  const handleExport = async () => {
    if (!organization?.id) return;
    setExporting(true);
    try {
      const result = await callSchoolAdminAction('export-org-data', { organizationId: organization.id });
      setExportResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      Alert.alert('Error', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: handleExport },
      ]);
    } finally {
      setExporting(false);
    }
  };

  const exportCount = (key: string): number =>
    Array.isArray(exportResult?.[key]) ? (exportResult[key] as unknown[]).length : 0;

  const handleCopyExport = async () => {
    if (!exportResult) return;
    await Clipboard.setStringAsync(JSON.stringify(exportResult, null, 2));
    haptic('confirm');
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2000);
  };

  const handleShareExport = async () => {
    if (!exportResult) return;
    try {
      await Share.share({ message: JSON.stringify(exportResult, null, 2) });
    } catch {
      // User cancelled the share sheet
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
                { text: 'OK', onPress: () => goBack() },
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
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView
          className="flex-1 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="flex-row items-center mb-4"
          >
            <Ionicons name="chevron-back" size={24} color={c.primary} />
            <Text className="text-base ml-1" style={{ fontFamily: 'Nunito_600SemiBold', color: c.primary }}>Back</Text>
          </Pressable>

          <Text
            className="text-[28px] mb-6"
            style={{ fontFamily: 'Nunito_800ExtraBold', color: c.ink }}
            accessibilityRole="header"
          >
            Data Management
          </Text>

          {/* Export Section */}
          <Text className="text-xl mb-3" style={{ fontFamily: 'Nunito_600SemiBold', color: c.ink }}>
            Export All Data
          </Text>
          <SlabCard style={{ marginBottom: 24 }}>
            <Text className="text-sm mb-4" style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}>
              Generate a complete export of all organization data including students, assignments, submissions, and chat transcripts in JSON format. You can then copy or share the exported data.
            </Text>
            <SlabButton
              label={exporting ? 'Exporting...' : 'Export Organization Data'}
              onPress={handleExport}
              loading={exporting}
              accessibilityHint="Export all organization data"
            />
            {exportResult && (
              <View className="mt-4">
                <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
                  <Ionicons name="checkmark-circle" size={16} color={c.green} />
                  <Text style={{ color: c.green, fontSize: 13, fontFamily: 'Nunito_500Medium' }}>
                    Export ready
                  </Text>
                </View>
                <Text className="text-sm mb-3" style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}>
                  {exportCount('classrooms')} classrooms · {exportCount('members')} members ·{' '}
                  {exportCount('assignments')} assignments · {exportCount('submissions')} submissions ·{' '}
                  {exportCount('chatMessages')} chat messages
                </Text>
                <View className="flex-row" style={{ gap: 10 }}>
                  <Pressable
                    onPress={handleCopyExport}
                    accessibilityRole="button"
                    accessibilityLabel="Copy export JSON to clipboard"
                    className="flex-row items-center"
                    style={{
                      backgroundColor: c.primaryTint,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 10,
                      gap: 6,
                    }}
                  >
                    <Ionicons
                      name={copiedExport ? 'checkmark-circle' : 'copy-outline'}
                      size={16}
                      color={copiedExport ? c.green : c.onTint}
                    />
                    <Text
                      style={{
                        color: copiedExport ? c.green : c.onTint,
                        fontSize: 14,
                        fontFamily: 'Nunito_600SemiBold',
                      }}
                    >
                      {copiedExport ? 'Copied' : 'Copy JSON'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleShareExport}
                    accessibilityRole="button"
                    accessibilityLabel="Share export JSON"
                    className="flex-row items-center"
                    style={{
                      backgroundColor: c.primaryTint,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 10,
                      gap: 6,
                    }}
                  >
                    <Ionicons name="share-outline" size={16} color={c.onTint} />
                    <Text style={{ color: c.onTint, fontSize: 14, fontFamily: 'Nunito_600SemiBold' }}>
                      Share
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </SlabCard>

          {/* Danger Zone */}
          <Text className="text-xl mb-3" style={{ fontFamily: 'Nunito_600SemiBold', color: c.error }}>
            Danger Zone
          </Text>
          <SlabCard
            style={{ marginBottom: 16, borderColor: c.error }}
          >
            <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
              <Ionicons name="warning-outline" size={20} color={c.error} />
              <Text className="text-base" style={{ fontFamily: 'Nunito_600SemiBold', color: c.ink }}>
                Permanently Delete All Data
              </Text>
            </View>
            <Text className="text-sm mb-4" style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}>
              This will permanently delete all organization data including classrooms, enrollments, assignments, submissions, and chat messages. This action cannot be undone.
            </Text>

            <Text className="text-sm mb-2" style={{ fontFamily: 'Nunito_500Medium', color: c.muted }}>
              Type "{organization?.name}" to confirm:
            </Text>
            <Ui2Input
              containerStyle={{ marginBottom: 16 }}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="Organization name"
              inputStyle={{ fontSize: 15 }}
              accessibilityLabel="Confirmation input"
            />

            <Pressable
              onPress={handleDelete}
              disabled={deleting || confirmText !== organization?.name}
              style={{
                backgroundColor: confirmText === organization?.name ? c.error : c.pinkTint,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                opacity: deleting ? 0.6 : 1,
              }}
              accessibilityRole="button"
              accessibilityLabel="Permanently delete all data"
            >
              {deleting ? (
                <ActivityIndicator color={c.onPrimary} />
              ) : (
                <Text style={{ color: confirmText === organization?.name ? c.onPrimary : c.error, fontSize: 16, fontFamily: 'Nunito_600SemiBold' }}>
                  Permanently Delete
                </Text>
              )}
            </Pressable>
          </SlabCard>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
