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
import { Body } from '../ui/Text';
import { Mono } from './Mono';
import { colors, radii, spacing, typography } from '../../config/theme';
import type { UnitProgress } from '../../lib/learn-progress';

interface UnitCarouselProps {
  units: UnitProgress[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const CARD_GAP = spacing.sm;
const CARD_HEIGHT = 148;

/** Card width as a fraction of the window, bounded so the peek survives on
 *  both a small phone and a tablet. */
function cardWidth(windowWidth: number): number {
  return Math.round(Math.min(272, Math.max(196, windowWidth * 0.56)));
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
  const { completedCount, totalCount, progress } = unit;
  const finished = totalCount > 0 && completedCount === totalCount;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Unit ${unit.index + 1}, ${unit.unit.title}`}
      accessibilityValue={{ text: `${completedCount} of ${totalCount} lessons complete` }}
      style={({ pressed }) => [
        styles.card,
        { width },
        selected ? styles.cardSelected : styles.cardIdle,
        pressed && styles.cardPressed,
      ]}
    >
      <Body
        style={[
          styles.number,
          { color: selected ? colors.indigo[300] : colors.text.quaternary },
        ]}
      >
        {String(unit.index + 1).padStart(2, '0')}
      </Body>

      <Body
        size="lg"
        weight="extrabold"
        tone={selected ? 'primary' : 'tertiary'}
        numberOfLines={2}
        style={styles.title}
      >
        {unit.unit.title}
      </Body>

      <View style={styles.progressRow}>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(progress * 100)}%`,
                backgroundColor: finished
                  ? colors.success.base
                  : selected
                    ? colors.indigo[400]
                    : 'rgba(255, 255, 255, 0.32)',
              },
            ]}
          />
        </View>
        <Mono
          size={11}
          medium
          color={selected ? colors.text.secondary : colors.text.tertiary}
          style={styles.count}
        >
          {`${completedCount}/${totalCount}`}
        </Mono>
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
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  cardIdle: {
    backgroundColor: colors.surface.card,
    borderColor: colors.border.subtle,
  },
  cardSelected: {
    backgroundColor: colors.action.primaryTint,
    borderColor: colors.action.primaryBorder,
  },
  cardPressed: {
    opacity: 0.8,
  },
  number: {
    // Fraunces carries its own weight — never pair it with fontWeight, which
    // makes Android synthesize a second bolding pass.
    fontFamily: typography.family.display,
    fontSize: 38,
    lineHeight: 47, // >= 38 * leading.display (1.233)
    letterSpacing: -1,
  },
  title: {
    marginTop: spacing.xxs,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
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
