/**
 * Settings › Offline downloads.
 *
 * What is on the device, how much of the 200 MB it uses, the Wi-Fi top-up
 * switch, and a way to remove one pack or all of them. For a plan without
 * offline mode it is the pitch and a button to Plans — the passive cache
 * (what you have already opened keeps working) is not shown here because it
 * is not a thing the learner manages.
 */
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { useOfflinePacks } from '../../../hooks/useOfflinePacks';
import { formatBytes, type OfflinePack } from '../../../lib/offline-packs';
import { Ui2Header } from '../../../components/ui2/Ui2Header';
import { Ui2ListRow } from '../../../components/ui2/Ui2ListRow';
import { Ui2ProgressBar } from '../../../components/ui2/Ui2ProgressBar';
import { Ui2EmptyState } from '../../../components/ui2/Ui2EmptyState';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { Body, Caption } from '../../../components/ui2/Ui2Text';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { useScreenView } from '../../../hooks/useScreenView';
import { spacing } from '../../../config/theme';

const KIND_ICON: Record<OfflinePack['kind'], keyof typeof Ionicons.glyphMap> = {
  unit: 'school-outline',
  book: 'book-outline',
  news: 'newspaper-outline',
};

function packSubtitle(pack: OfflinePack): string {
  const when = new Date(pack.downloadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return [pack.subtitle, `${formatBytes(pack.bytes)} · ${when}`].filter(Boolean).join(' · ');
}

export default function OfflineDownloadsScreen() {
  useScreenView('offline_downloads');
  const { c } = useUi2Theme();
  const router = useRouter();
  const goBack = useSafeBack('/(app)/profile/settings');
  const packs = useOfflinePacks();

  const confirmRemove = useCallback(
    (pack: OfflinePack) => {
      Alert.alert('Remove download?', `${pack.title} will no longer be available without a connection.`, [
        { text: 'Keep', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void packs.remove(pack.id) },
      ]);
    },
    [packs],
  );

  const confirmClear = useCallback(() => {
    Alert.alert('Remove all downloads?', 'Everything downloaded for offline use will be removed. Nothing about your progress changes.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove all', style: 'destructive', onPress: () => void packs.clearAll() },
    ]);
  }, [packs]);

  const used = packs.maxBytes > 0 ? Math.min(1, packs.totalBytes / packs.maxBytes) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <Ui2Header title="Offline downloads" onBack={() => goBack()} />

      {!packs.entitled ? (
        <View style={{ flex: 1, padding: spacing.lg }}>
          <Ui2EmptyState
            icon="cloud-download-outline"
            title="Learn without a connection"
            description="Premium downloads your next lessons with every exercise, the books you are reading, and today's news with its narration — automatically on Wi-Fi, or whenever you ask."
            actionLabel="See plans"
            onAction={() => router.push('/plans' as never)}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxxl }}>
          {/* Storage */}
          <View style={{ backgroundColor: c.card, borderRadius: 22, padding: spacing.md, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
              <Body weight="semibold">On this device</Body>
              <Caption>{`${formatBytes(packs.totalBytes)} of ${formatBytes(packs.maxBytes)}`}</Caption>
            </View>
            <Ui2ProgressBar progress={used} onCard accessibilityLabel={`${Math.round(used * 100)} percent of the offline storage budget used`} />
            <Caption style={{ marginTop: spacing.xs }}>
              Oldest downloads are removed first when the budget is full, and after 30 days unused.
            </Caption>
          </View>

          {/* Auto-download */}
          <Pressable
            onPress={() => void packs.setAutoDownload(!packs.autoDownload)}
            accessibilityRole="switch"
            accessibilityState={{ checked: packs.autoDownload }}
            accessibilityLabel="Download automatically on Wi-Fi"
            accessibilityHint="Keeps your next two units, the books you are reading and today's news on the device"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              borderRadius: 22,
              marginBottom: spacing.md,
              backgroundColor: packs.autoDownload ? c.primaryTint : c.card,
            }}
          >
            <Ionicons
              name={packs.autoDownload ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={packs.autoDownload ? c.onTint : c.idle}
            />
            <View style={{ marginLeft: spacing.sm, flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>Download automatically on Wi-Fi</Text>
              <Text style={{ color: c.muted, fontSize: 14, marginTop: 2 }}>
                Your next two units, the books you are reading and today's news, while the app is open on Wi-Fi.
              </Text>
            </View>
          </Pressable>

          {/* Packs */}
          {packs.isLoading ? null : packs.packs.length === 0 ? (
            <Ui2EmptyState
              icon="cloud-offline-outline"
              title="Nothing downloaded yet"
              description="Use Download on a unit, a book or an article — or leave Wi-Fi downloads on and it happens by itself."
            />
          ) : (
            <View>
              <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.xs }}>
                Downloaded
              </Text>
              {packs.packs.map((pack) => (
                <Ui2ListRow
                  key={pack.id}
                  style={{ marginBottom: spacing.sm }}
                  icon={KIND_ICON[pack.kind]}
                  title={pack.title}
                  subtitle={packSubtitle(pack)}
                  onPress={() => confirmRemove(pack)}
                  accessibilityLabel={`${pack.title}, ${formatBytes(pack.bytes)}. Remove download`}
                  right={<Ionicons name="trash-outline" size={20} color={c.muted} />}
                />
              ))}
              <View style={{ marginTop: spacing.md }}>
                <SlabButton label="Remove all downloads" variant="tint" arrow={false} onPress={confirmClear} />
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
