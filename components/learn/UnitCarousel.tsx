/**
 * UnitCarousel — the horizontal strip of unit cards above the lesson list.
 *
 * Each card is a serif index number, the unit title, and a progress track with
 * a `3/6` readout. Selecting a card swaps the lesson list below it; the
 * carousel is a *selector*, not a navigation step, so tapping never leaves the
 * screen.
 *
 * Cards are deliberately narrower than the window so the next one peeks in —
 * that peek is the affordance that the strip scrolls, and it is why the header
 * can get away with a single `SWIPE →` hint instead of arrows.
 */

import React, { useEffect, useRef } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native';
import { Body } from '../ui2/Ui2Text';
import { Mono } from './Mono';
import { usePressed } from '../../hooks/usePressed';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { radii, spacing } from '../../config/theme';
import type { UnitProgress } from '../../lib/learn-progress';

interface UnitCarouselProps {
  units: UnitProgress[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const CARD_GAP = spacing.sm;
const CARD_HEIGHT = 64;

/** Card width as a fraction of the window, bounded so the peek survives on
 *  both a small phone and a tablet. */
function cardWidth(windowWidth: number): number {
  // Dense strip (canvas "Learn · variations", L2): two and a bit units per
  // screen, so the course's shape is visible without scrolling the strip.
  return Math.round(Math.min(232, Math.max(176, windowWidth * 0.5)));
}

export function UnitCarousel({ units, selectedIndex, onSelect }: UnitCarouselProps) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<UnitProgress>>(null);
  const CARD_W = cardWidth(width);

  // Follow the selection, whichever way it was set — a card tap, or the
  // initial focus on the unit holding the next unlocked lesson.
  useEffect(() => {
    if (units.length === 0) return;
    const target = Math.min(selectedIndex, units.length - 1);
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: target,
        animated: true,
        viewPosition: 0,
        viewOffset: spacing.md,
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [selectedIndex, units.length]);

  const renderItem = ({ item, index }: ListRenderItemInfo<UnitProgress>) => (
    <UnitCard
      unit={item}
      width={CARD_W}
      selected={index === selectedIndex}
      onPress={() => onSelect(index)}
    />
  );

  return (
    <FlatList
      ref={listRef}
      data={units}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.unit.id}
      renderItem={renderItem}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={styles.content}
      snapToInterval={CARD_W + CARD_GAP}
      snapToAlignment="start"
      decelerationRate="fast"
      getItemLayout={(_, index) => ({
        length: CARD_W + CARD_GAP,
        offset: (CARD_W + CARD_GAP) * index,
        index,
      })}
      // A failed measurement would otherwise throw out of scrollToIndex; retry
      // once the row has actually been laid out.
      onScrollToIndexFailed={({ index }) => {
        setTimeout(() => {
          listRef.current?.scrollToOffset({
            offset: (CARD_W + CARD_GAP) * index,
            animated: true,
          });
        }, 80);
      }}
    />
  );
}

function Separator() {
  return <View style={{ width: CARD_GAP }} />;
}

// ─── Card ─────────────────────────────────────────────────────────────────

interface UnitCardProps {
  unit: UnitProgress;
  width: number;
  selected: boolean;
  onPress: () => void;
}

const UnitCard = React.memo(function UnitCard({
  unit,
  width,
  selected,
  onPress,
}: UnitCardProps) {
  const { c } = useUi2Theme();
  const { pressed, pressHandlers } = usePressed();
  const { completedCount, totalCount, progress } = unit;
  const finished = totalCount > 0 && completedCount === totalCount;

  return (
    <Pressable
      onPress={onPress}
      {...pressHandlers}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Unit ${unit.index + 1}, ${unit.unit.title}`}
      accessibilityValue={{ text: `${completedCount} of ${totalCount} lessons complete` }}
      style={[
        styles.card,
        { width },
        { backgroundColor: selected ? c.primary : c.card },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.titleRow}>
        <Mono size={11} medium color={selected ? c.onPrimaryMuted : c.idle}>
          {String(unit.index + 1).padStart(2, '0')}
        </Mono>
        <Body
          size="sm"
          weight="extrabold"
          tone={selected ? 'onPrimary' : 'primary'}
          numberOfLines={1}
          style={styles.title}
        >
          {unit.unit.title}
        </Body>
        <Mono size={11} medium color={selected ? c.onPrimaryMuted : c.idle} style={styles.count}>
          {`${completedCount}/${totalCount}`}
        </Mono>
      </View>

      <View style={styles.progressRow}>
        <View style={[styles.track, { backgroundColor: selected ? c.slab : c.track }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: finished ? c.green : selected ? c.onPrimary : c.idle,
              },
            ]}
          />
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    justifyContent: 'space-between',
  },
  cardPressed: {
    opacity: 0.8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  count: {
    marginLeft: spacing.xs,
  },
});
