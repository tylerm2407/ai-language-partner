/**
 * The premade avatar grid.
 *
 * This replaced the layer-based customizer, which built an SVG face from
 * head/hair/eyes/mouth pickers. Fifty hand-checked illustrations beat a
 * combinatorial builder here for a reason worth writing down: the builder's
 * output was only as good as its worst layer combination, and nobody was ever
 * going to review all of them. Every tile in this grid has been looked at.
 *
 * Read-only content — choosing writes `avatar_kind` and `avatar_preset_id`
 * through setAvatarKind and nothing else.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Sheet } from '../ui/Sheet';
import { Body, Caption } from '../ui/Text';
import { colors, radii, spacing } from '../../config/theme';
import { fetchAvatarPresets, type AvatarPreset } from '../../lib/avatar-presets';

interface AvatarPresetPickerProps {
  visible: boolean;
  onClose: () => void;
  /** Currently-selected preset id, so the grid can show a checked state. */
  selectedId?: string | null;
  /** Called with the chosen preset. The caller owns persistence. */
  onSelect: (preset: AvatarPreset) => void;
  /** Optional route into the photo-avatar flow, shown as a footer action. */
  onUsePhoto?: () => void;
}

const COLUMNS = 3;

export const AvatarPresetPicker = React.memo(
  ({ visible, onClose, selectedId, onSelect, onUsePhoto }: AvatarPresetPickerProps) => {
    const [presets, setPresets] = useState<AvatarPreset[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const load = useCallback(async () => {
      setLoading(true);
      setFailed(false);
      try {
        setPresets(await fetchAvatarPresets());
      } catch (err) {
        // Surfaced as a retry rather than an empty grid: the two look the same
        // to a learner and mean very different things (CLAUDE.md §5).
        console.error('[avatar-presets] catalogue fetch failed:', err);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      if (visible) load();
    }, [visible, load]);

    const renderTile = useCallback(
      ({ item }: { item: AvatarPreset }) => {
        const selected = item.id === selectedId;
        return (
          <Pressable
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Avatar ${item.id}`}
            style={[styles.tile, selected && styles.tileSelected]}
          >
            <Image source={{ uri: item.url }} style={styles.tileImage} resizeMode="cover" />
          </Pressable>
        );
      },
      [selectedId, onSelect],
    );

    return (
      <Sheet visible={visible} onDismiss={onClose} dismissOnBackdrop>
        <View style={styles.container}>
          <Body style={styles.title}>Choose your avatar</Body>

          {loading ? (
            <View style={styles.state}>
              <ActivityIndicator size="large" color={colors.action.accent} />
            </View>
          ) : failed ? (
            <View style={styles.state}>
              <Caption style={styles.errorText}>
                Couldn&apos;t load the avatars. Check your connection and try again.
              </Caption>
              <Pressable onPress={load} accessibilityRole="button" accessibilityLabel="Try again">
                <Body style={styles.link}>Try again</Body>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={presets}
              keyExtractor={(p) => p.id}
              renderItem={renderTile}
              numColumns={COLUMNS}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
              // The grid is a fixed 50 tiles of known size, so windowing can be
              // tuned tightly rather than left at the list defaults.
              initialNumToRender={12}
              windowSize={5}
            />
          )}

          {onUsePhoto && (
            <Pressable
              onPress={onUsePhoto}
              accessibilityRole="button"
              accessibilityLabel="Make an avatar from a photo instead"
              style={styles.footerAction}
            >
              <Body style={styles.link}>Use a photo instead</Body>
            </Pressable>
          )}
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.footerAction}>
            <Body style={styles.secondaryText}>Cancel</Body>
          </Pressable>
        </View>
      </Sheet>
    );
  },
);

AvatarPresetPicker.displayName = 'AvatarPresetPicker';

const TILE = 96;

const styles = StyleSheet.create({
  container: { padding: spacing.lg, maxHeight: '85%' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.sm },
  state: { paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  errorText: { color: colors.text.secondary, textAlign: 'center' },
  grid: { paddingBottom: spacing.sm },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: TILE / 2,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: colors.surface.cardAlt,
  },
  tileSelected: { borderColor: colors.action.accent },
  tileImage: { width: '100%', height: '100%' },
  footerAction: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  link: { color: colors.action.accent, fontWeight: '600' },
  secondaryText: { color: colors.text.tertiary },
});
