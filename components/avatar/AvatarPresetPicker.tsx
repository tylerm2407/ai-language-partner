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
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
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
      ({ item, index }: { item: AvatarPreset; index: number }) => {
        const selected = item.id === selectedId;
        return (
          <Pressable
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Avatar option ${index + 1}`}
            style={[styles.tile, selected && styles.tileSelected]}
          >
            <Image
              source={{ uri: item.url }}
              style={styles.tileImage}
              resizeMode="cover"
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </Pressable>
        );
      },
      [selectedId, onSelect],
    );

    return (
      <Sheet visible={visible} onDismiss={onClose} dismissOnBackdrop height={SHEET_HEIGHT}>
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
              // `style` bounds the scroll viewport; contentContainerStyle only
              // pads what is inside it. Without the former the list grows to fit
              // all fifty tiles and stops scrolling.
              style={styles.gridList}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
              // The grid is a fixed 50 tiles of known size, so windowing can be
              // tuned tightly rather than left at the list defaults.
              initialNumToRender={12}
              windowSize={5}
            />
          )}

          {/* Pinned below the grid rather than after it. The grid owns all the
              space left over (flex: 1) and scrolls inside it, so these two stay
              put at the bottom the way a photo picker's actions do — they never
              scroll away and never get pushed off-screen by fifty tiles. */}
          <View style={styles.footer}>
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
        </View>
      </Sheet>
    );
  },
);

AvatarPresetPicker.displayName = 'AvatarPresetPicker';

/**
 * Tile size is derived from the viewport rather than fixed, so three columns
 * fill the row on every device instead of leaving a ragged gutter on wide
 * screens and overflowing on narrow ones. The subtractions are the sheet's own
 * horizontal padding (spacing.lg either side) plus the gaps between columns.
 */
const SCREEN = Dimensions.get('window');
const GUTTER = spacing.sm;
const TILE = Math.floor((SCREEN.width - spacing.lg * 2 - GUTTER * (COLUMNS - 1)) / COLUMNS);

/**
 * 85% of the viewport. A real pixel value, not a percentage: `maxHeight: '85%'`
 * resolves against a parent with no definite height inside the sheet, so it was
 * silently ignored and the grid collapsed to a sliver at the top.
 */
const SHEET_HEIGHT = Math.round(SCREEN.height * 0.85);

const styles = StyleSheet.create({
  // flex: 1 so the grid can claim the space the pinned sheet height provides.
  container: { flex: 1, paddingTop: spacing.xs },
  title: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.sm },
  // The loading and error states sit where the grid would, not above it, so the
  // sheet does not resize as it settles.
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  errorText: { color: colors.text.secondary, textAlign: 'center' },
  gridList: { flex: 1 },
  grid: { paddingBottom: spacing.md },
  row: { gap: GUTTER, marginBottom: GUTTER },
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
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.xs,
  },
  footerAction: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  link: { color: colors.action.accent, fontWeight: '600' },
  secondaryText: { color: colors.text.tertiary },
});
