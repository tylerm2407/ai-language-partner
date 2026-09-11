/**
 * The one control that puts content on the device for offline use.
 *
 * Four states, each said in words as well as an icon (status is never
 * colour-only):
 *   locked      — the plan does not include offline mode; opens Plans
 *   idle        — "Download"
 *   downloading — spinner and "3 of 6"
 *   done        — "Offline" with a check; pressing offers to remove the pack
 *
 * Lives on the unit header, the book cover and the news article. It is a
 * tint pill, the same shape as every other quiet action in UI 2.0, so it
 * reads as a state of the thing beside it rather than a call to action.
 */
import { useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOfflinePacks, type PackTarget } from '../../hooks/useOfflinePacks';
import { packId } from '../../lib/offline-packs';
import { Caption } from '../ui2/Ui2Text';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { usePressed } from '../../hooks/usePressed';
import { haptic } from '../../lib/haptics';
import { spacing } from '../../config/theme';

interface OfflineDownloadControlProps {
  spec: PackTarget;
  /** What is being downloaded, for the accessibility label: "Unit 3". */
  what: string;
  /** Compact: icon only until it is downloading or done. */
  compact?: boolean;
}

function refIdOf(spec: PackTarget): string {
  if (spec.kind === 'unit') return spec.target.unitId;
  if (spec.kind === 'book') return spec.target.bookId;
  return `${spec.target.language}:${spec.target.date ?? 'today'}`;
}

export function OfflineDownloadControl({ spec, what, compact = false }: OfflineDownloadControlProps) {
  const { c } = useUi2Theme();
  // Plain boolean, not the callback `style` form: NativeWind drops that form
  // silently (see hooks/usePressed.ts).
  const { pressed, pressHandlers } = usePressed();
  const router = useRouter();
  const packs = useOfflinePacks();
  const refId = refIdOf(spec);
  const progress = packs.progressFor(spec.kind, refId);
  const done = packs.hasPack(spec.kind, refId);

  const onPress = useCallback(() => {
    if (!packs.entitled) {
      router.push('/plans' as never);
      return;
    }
    if (progress) return;
    if (done) {
      Alert.alert(
        'Remove download?',
        `${what} will no longer be available without a connection.`,
        [
          { text: 'Keep', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => void packs.remove(packId(spec.kind, refId)) },
        ],
      );
      return;
    }
    haptic('select');
    void packs.download(spec).then((pack) => {
      if (!pack && packs.lastError) {
        Alert.alert('Download failed', packs.lastError);
      }
    });
  }, [packs, progress, done, router, spec, refId, what]);

  const label = !packs.entitled
    ? 'Offline · Premium'
    : progress
      ? progress.total > 1 ? `${progress.done} of ${progress.total}` : 'Downloading'
      : done
        ? 'Offline'
        : 'Download';
  const icon: keyof typeof Ionicons.glyphMap = !packs.entitled
    ? 'lock-closed-outline'
    : done
      ? 'checkmark-circle'
      : 'cloud-download-outline';
  const tint = done ? c.green : packs.entitled ? c.primary : c.muted;
  const showLabel = !compact || progress !== undefined || done;

  return (
    <Pressable
      onPress={onPress}
      disabled={progress !== undefined}
      accessibilityRole="button"
      accessibilityLabel={
        !packs.entitled
          ? `Offline downloads are part of Premium. Opens plans`
          : progress
            ? `Downloading ${what}, ${progress.done} of ${progress.total}`
            : done
              ? `${what} is available offline. Remove download`
              : `Download ${what} for offline use`
      }
      accessibilityState={{ busy: progress !== undefined, disabled: progress !== undefined }}
      hitSlop={8}
      {...pressHandlers}
      style={[
        styles.pill,
        { backgroundColor: done ? c.greenTint : c.primaryTint, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {progress ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <Ionicons name={icon} size={16} color={tint} />
      )}
      {showLabel && (
        <View style={styles.labelWrap}>
          <Caption style={{ color: done ? c.green : packs.entitled ? c.onTint : c.muted }}>{label}</Caption>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: { marginLeft: spacing.xs },
});
