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
 *
 * Above the grid sits the learner's own gallery: every portrait they have
 * generated from a photo and still own. Each one cost a paid render, and
 * until 2026-09-08 picking a preset afterwards made it unreachable (and the
 * next generation deleted it). The row exists so a portrait is never lost by
 * choosing something else — the caller owns persistence here too.
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
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '../ui/Sheet';
import { Body, Caption } from '../ui/Text';
import { spacing, ui2Dark, ui2Light, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { fetchAvatarPresets, type AvatarPreset } from '../../lib/avatar-presets';
import { useAvatarImage } from '../../hooks/useAvatarImage';

interface AvatarPresetPickerProps {
  visible: boolean;
  onClose: () => void;
  /** Currently-selected preset id, so the grid can show a checked state. */
  selectedId?: string | null;
  /** Called with the chosen preset. The caller owns persistence. */
  onSelect: (preset: AvatarPreset) => void;
  /** Optional route into the photo-avatar flow, shown as a footer action. */
  onUsePhoto?: () => void;
  /**
   * Storage paths of the learner's generated portraits, newest first. `null`
   * while loading; `[]` when there are none, in which case the row is hidden.
   */
  generated?: string[] | null;
  /** The listing failed — shown as a retry, never as an empty row. */
  generatedError?: boolean;
  onRetryGenerated?: () => void;
  /** Path currently on the profile, for the checked state. */
  selectedGeneratedPath?: string | null;
  onSelectGenerated?: (path: string) => void;
  /** Remove a portrait. The caller confirms and persists; the tile only asks. */
  onDeleteGenerated?: (path: string) => void;
}

const COLUMNS = 3;

export const AvatarPresetPicker = React.memo(
  ({
    visible,
    onClose,
    selectedId,
    onSelect,
    onUsePhoto,
    generated,
    generatedError,
    onRetryGenerated,
    selectedGeneratedPath,
    onSelectGenerated,
    onDeleteGenerated,
  }: AvatarPresetPickerProps) => {
    const { c, scheme } = useUi2Theme();
    const styles = STYLES[scheme];
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
      // `styles` joins the deps because it is no longer a module constant: it
      // is `STYLES[scheme]`, so a phone switching to dark mid-session must
      // rebuild the tiles. The reference is stable per scheme, so this does not
      // re-render on anything else.
      [selectedId, onSelect, styles],
    );

    // The gallery renders as the grid's header so it scrolls with the tiles
    // and the fifty presets keep their windowing.
    const showGallery = !!onSelectGenerated && (generatedError || (generated?.length ?? 0) > 0);
    const gallery = showGallery ? (
      <View style={styles.gallery}>
        <Caption style={styles.galleryTitle}>Your photo avatars</Caption>
        {generatedError ? (
          <View style={styles.galleryError}>
            <Caption style={styles.errorText}>Couldn&apos;t load your photo avatars.</Caption>
            {onRetryGenerated && (
              <Pressable onPress={onRetryGenerated} accessibilityRole="button" accessibilityLabel="Try loading your photo avatars again">
                <Body style={styles.link}>Try again</Body>
              </Pressable>
            )}
          </View>
        ) : (
          <FlatList
            horizontal
            data={generated ?? []}
            keyExtractor={(p) => p}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryRow}
            renderItem={({ item, index }) => (
              <GeneratedTile
                path={item}
                index={index}
                selected={item === selectedGeneratedPath}
                onPress={() => onSelectGenerated?.(item)}
                onDelete={onDeleteGenerated ? () => onDeleteGenerated(item) : undefined}
                deleteColor={c.error}
                deleteIconColor={c.onError}
                styles={styles}
              />
            )}
          />
        )}
        <Caption style={styles.galleryHint}>
          Every avatar you generate is kept here.{onDeleteGenerated ? ' Tap × to delete one.' : ''}
        </Caption>
      </View>
    ) : null;

    return (
      <Sheet visible={visible} onDismiss={onClose} dismissOnBackdrop height={SHEET_HEIGHT}>
        <View style={styles.container}>
          <Body style={styles.title}>Choose your avatar</Body>

          {loading ? (
            <View style={styles.state}>
              <ActivityIndicator size="large" color={c.primary} />
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
              ListHeaderComponent={gallery}
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
 * One generated portrait. The bucket is private, so each tile signs its own
 * URL through the shared `useAvatarImage` cache; while that resolves the tile
 * is a plain disc rather than a broken image.
 */
function GeneratedTile({
  path,
  index,
  selected,
  onPress,
  onDelete,
  deleteColor,
  deleteIconColor,
  styles,
}: {
  path: string;
  index: number;
  selected: boolean;
  onPress: () => void;
  onDelete?: () => void;
  deleteColor: string;
  /** Glyph on the solid error badge — `onError`, the token for text on that fill. */
  deleteIconColor: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const uri = useAvatarImage(path);
  const name = `Your photo avatar ${index + 1}`;
  return (
    // The wrapper is wider than the disc so the delete badge can sit on the
    // rim without being clipped by the tile's overflow: hidden.
    <View style={styles.galleryTileWrap}>
      <Pressable
        onPress={onPress}
        onLongPress={onDelete}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${name}${selected ? ', current' : ''}`}
        accessibilityHint={onDelete ? 'Long press to delete' : undefined}
        style={[styles.galleryTile, selected && styles.tileSelected]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.tileImage}
            resizeMode="cover"
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
      </Pressable>
      {onDelete && (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${name.toLowerCase()}`}
          // 24pt badge, 44pt target through the slop (Apple HIG).
          hitSlop={10}
          style={[styles.galleryDelete, { backgroundColor: deleteColor }]}
        >
          <Ionicons name="close" size={14} color={deleteIconColor} />
        </Pressable>
      )}
    </View>
  );
}

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

/** Gallery tiles are smaller than grid tiles: a row, not a grid, and fewer of them. */
const GALLERY_TILE = 72;


/**
 * The sheet is built once per SCHEME, at module load, rather than per render.
 * A `StyleSheet.create` inside the component would re-register the whole sheet
 * on every render, and wrapping it in `useMemo` would add a hook to a file
 * where the migration is supposed to add exactly one. Two frozen sheets and an
 * index by scheme costs nothing and keeps the colour in tokens.
 */
const makeStyles = (c: Ui2Palette) => StyleSheet.create({
  // flex: 1 so the grid can claim the space the pinned sheet height provides.
  container: { flex: 1, paddingTop: spacing.xs },
  title: { fontSize: 20, fontWeight: '700', color: c.ink, marginBottom: spacing.sm },
  // The loading and error states sit where the grid would, not above it, so the
  // sheet does not resize as it settles.
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  errorText: { color: c.muted, textAlign: 'center' },
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
    backgroundColor: c.surface2,
  },
  tileSelected: { borderColor: c.primary },
  tileImage: { width: '100%', height: '100%' },
  gallery: { marginBottom: spacing.md, gap: spacing.xs },
  galleryTitle: { color: c.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  galleryRow: { gap: GUTTER, paddingVertical: 2 },
  galleryTile: {
    width: GALLERY_TILE,
    height: GALLERY_TILE,
    borderRadius: GALLERY_TILE / 2,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: c.surface2,
  },
  galleryTileWrap: { width: GALLERY_TILE + 8, height: GALLERY_TILE + 8, padding: 4 },
  galleryDelete: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.bg,
  },
  galleryError: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  galleryHint: { color: c.idle, fontSize: 12 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: c.cardBorder,
    paddingTop: spacing.xs,
  },
  footerAction: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  link: { color: c.primary, fontWeight: '600' },
  secondaryText: { color: c.idle },
});

const STYLES = { light: makeStyles(ui2Light), dark: makeStyles(ui2Dark) };
