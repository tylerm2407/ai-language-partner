/**
 * NarrationBar — the book reader's read-aloud controls, out of the header and
 * into a bar above the pager where a thumb can reach them.
 *
 * Play/pause, the speed chip, and Auto-advance as a real switch (it was a
 * hardcoded `useState(true)` with no setter). The status line says what the
 * narrator is doing in words, so playing versus paused is never carried by
 * the icon alone. The narrator itself (`hooks/usePageNarrator.ts`) is
 * untouched; this only renders what it already returns.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '../ui2/Chip';
import { Caption } from '../ui2/Ui2Text';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { spacing } from '../../config/theme';

interface Props {
  isPlaying: boolean;
  isPaused: boolean;
  speed: number;
  /** 1-based, for the status line. */
  page: number;
  autoAdvance: boolean;
  onPlayPause: () => void;
  onCycleSpeed: () => void;
  onToggleAutoAdvance: () => void;
}

/** Pure so the copy is asserted rather than read off a device. */
export function narrationStatus(isPlaying: boolean, isPaused: boolean, page: number): string {
  if (isPlaying && !isPaused) return `Reading page ${page} aloud`;
  if (isPaused) return 'Paused';
  return 'Read this page aloud';
}

export function NarrationBar({
  isPlaying,
  isPaused,
  speed,
  page,
  autoAdvance,
  onPlayPause,
  onCycleSpeed,
  onToggleAutoAdvance,
}: Props) {
  const { c, shape } = useUi2Theme();
  const active = isPlaying && !isPaused;

  return (
    <View style={[styles.bar, { backgroundColor: c.card, borderRadius: shape.radiusCard }]}>
      <Pressable
        onPress={onPlayPause}
        accessibilityRole="button"
        accessibilityLabel={active ? 'Pause narration' : 'Play narration'}
        style={[styles.play, { backgroundColor: c.primary, borderRadius: shape.radiusButton }]}
      >
        <Ionicons name={active ? 'pause' : 'play'} size={22} color={c.onPrimary} style={active ? undefined : styles.playGlyph} />
      </Pressable>

      <View style={styles.middle}>
        <Caption tone="secondary" numberOfLines={1}>
          {narrationStatus(isPlaying, isPaused, page)}
        </Caption>
        <View style={styles.chips}>
          <Chip
            label={`${speed}×`}
            variant="neutral"
            onPress={onCycleSpeed}
          />
          <Pressable
            onPress={onToggleAutoAdvance}
            accessibilityRole="switch"
            accessibilityLabel="Auto-advance pages"
            accessibilityState={{ checked: autoAdvance }}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={[
              styles.autoChip,
              {
                backgroundColor: autoAdvance ? c.primaryTint : c.surface2,
                borderRadius: shape.radiusButton,
              },
            ]}
          >
            <Ionicons name="play-skip-forward" size={12} color={autoAdvance ? c.onTint : c.muted} />
            <Caption size="sm" style={{ color: autoAdvance ? c.onTint : c.muted, marginLeft: spacing.xxs }}>
              Auto
            </Caption>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    minHeight: 56,
  },
  // 44pt target (Apple HIG).
  play: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  playGlyph: { marginLeft: 2 },
  middle: { flex: 1, marginLeft: spacing.sm },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxs },
  autoChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, minHeight: 24 },
});
