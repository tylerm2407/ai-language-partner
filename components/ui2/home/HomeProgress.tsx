/**
 * Home, UI 2.0 — the lower page: continue-learning unit rows, the daily
 * three, the week strip, and the talk / hands-free action rows.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../SlabCard';
import { useHomeEnter } from './HomeSections';
import { haptic } from '../../../lib/haptics';
import { localDayKey } from '../../../lib/dates';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import type { DailyStats } from '../../../types';
import type { LessonTileData } from '../../magazine/LessonTile';
import type { ErrorCopy } from '../../../lib/error-copy';

// Unit rows cycle these so adjacent units stay distinguishable.
const UNIT_COLORS = ['primary', 'pink', 'yellow', 'green'] as const;

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { c, type } = useUi2Theme();
  return (
    <View style={styles.sectionHead}>
      <Text accessibilityRole="header" style={{ fontFamily: type.heading, fontSize: 18, color: c.ink }}>
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={action} hitSlop={8}>
          <Text style={{ fontFamily: type.uiHeavy, fontSize: 13, color: c.primary }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Continue learning ─────────────────────────────────────────────────────
interface UnitRowsProps {
  tiles: LessonTileData[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpen: (tile: LessonTileData) => void;
  onAll: () => void;
}

export function UnitRows({ tiles, loading, error, onRetry, onOpen, onAll }: UnitRowsProps) {
  const { c, type } = useUi2Theme();
  const enter = useHomeEnter();

  if (!loading && error && (!tiles || tiles.length === 0)) {
    return (
      <Animated.View entering={enter(4)} style={styles.section}>
        <SectionTitle title="Continue learning" />
        <SlabCard style={{ gap: 8 }}>
          <Text style={{ fontFamily: type.uiBold, fontSize: 14, color: c.error }}>Couldn&apos;t load your lessons.</Text>
          <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry loading lessons" style={styles.retry}>
            <Text style={{ fontFamily: type.uiHeavy, fontSize: 13, color: c.primary }}>Try again</Text>
          </Pressable>
        </SlabCard>
      </Animated.View>
    );
  }

  if (loading && !tiles) {
    return (
      <Animated.View entering={enter(4)} style={styles.section}>
        <SectionTitle title="Continue learning" />
        {[0, 1].map((i) => (
          <SlabCard key={i} style={styles.unitRow}>
            <View style={[styles.pctTile, { backgroundColor: c.surface2 }]} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={[styles.skeleton, { backgroundColor: c.trackOnCard, width: '55%' }]} />
              <View style={[styles.bar, { backgroundColor: c.trackOnCard }]} />
            </View>
          </SlabCard>
        ))}
      </Animated.View>
    );
  }

  if (!tiles || tiles.length === 0) return null;

  return (
    <Animated.View entering={enter(4)} style={styles.section}>
      <SectionTitle title="Continue learning" action="All units" onAction={onAll} />
      {tiles.map((tile, i) => {
        const pct = Math.round(Math.min(Math.max(tile.progress, 0), 1) * 100);
        const key = UNIT_COLORS[i % UNIT_COLORS.length];
        const color = key === 'primary' ? c.primary : key === 'pink' ? c.pink : key === 'yellow' ? c.yellow : c.green;
        const tint = key === 'primary' ? c.primaryTint : key === 'pink' ? c.pinkTint : key === 'yellow' ? c.yellowTint : c.greenTint;
        const onPct = key === 'primary' ? c.onTint : c.ink;
        return (
          <Pressable
            key={tile.id}
            onPress={() => {
              haptic('select');
              onOpen(tile);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${tile.title}, ${tile.completedCount} of ${tile.lessonCount} lessons, ${pct} percent complete`}
          >
            <SlabCard style={styles.unitRow}>
              <View style={[styles.pctTile, { backgroundColor: tint }]}>
                <Text style={{ fontFamily: type.heading, fontSize: 13, color: onPct }}>{pct}%</Text>
              </View>
              <View style={{ flex: 1, gap: 7, minWidth: 0 }}>
                <View style={styles.unitTop}>
                  <Text style={{ fontFamily: type.uiHeavy, fontSize: 15, color: c.ink, flex: 1 }} numberOfLines={1}>
                    {tile.title}
                  </Text>
                  <Text style={{ fontFamily: type.uiHeavy, fontSize: 12, color: c.muted }}>
                    {tile.completedCount} / {tile.lessonCount}
                  </Text>
                </View>
                <View style={[styles.bar, { backgroundColor: c.trackOnCard }]}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.idle} />
            </SlabCard>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

// ─── Daily three ───────────────────────────────────────────────────────────
export interface DailyThreeItem {
  type: string;
  title: string;
  current: number;
  target: number;
}

export function DailyThree({ items }: { items: DailyThreeItem[] }) {
  const { c, type } = useUi2Theme();
  const enter = useHomeEnter();
  if (items.length === 0) return null;
  return (
    <Animated.View entering={enter(5)} style={styles.section}>
      <SectionTitle title="Your daily three" />
      <SlabCard style={{ gap: 14 }}>
        {items.map((it) => {
          const done = it.target > 0 && it.current >= it.target;
          const pct = it.target > 0 ? Math.min(it.current / it.target, 1) * 100 : 0;
          return (
            <View key={it.type} style={styles.dailyRow} accessibilityLabel={`${it.title}: ${it.current} of ${it.target}${done ? ', done' : ''}`}>
              <View style={[styles.dot, { backgroundColor: done ? c.green : c.trackOnCard }]}>
                {done && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.unitTop}>
                  <Text style={{ fontFamily: type.uiBold, fontSize: 14, color: done ? c.muted : c.ink, flex: 1 }} numberOfLines={1}>
                    {it.title}
                  </Text>
                  <Text style={{ fontFamily: type.uiHeavy, fontSize: 12, color: c.muted }}>
                    {Math.min(it.current, it.target)} / {it.target}
                  </Text>
                </View>
                <View style={[styles.bar, { backgroundColor: c.trackOnCard, height: 6 }]}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: c.green }]} />
                </View>
              </View>
            </View>
          );
        })}
      </SlabCard>
    </Animated.View>
  );
}

// ─── Week strip ────────────────────────────────────────────────────────────
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function WeekStrip({ stats, error, onRetry }: { stats: DailyStats[]; error?: ErrorCopy | null; onRetry?: () => void }) {
  const { c, type } = useUi2Theme();
  const enter = useHomeEnter();

  // Monday-first week, keyed by local day so a late-night session lands on
  // the day the learner experienced it.
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - mondayOffset + i);
    const key = localDayKey(d);
    const stat = stats.find((s) => s.date === key);
    return { key, label: DAY_LABELS[i], minutes: stat?.minutesPracticed ?? 0, future: i > mondayOffset, isToday: i === mondayOffset };
  });
  const max = Math.max(1, ...days.map((d) => d.minutes));
  const total = days.reduce((n, d) => n + d.minutes, 0);

  return (
    <Animated.View entering={enter(6)} style={styles.section}>
      <SectionTitle title="This week" />
      <SlabCard style={{ gap: 12 }}>
        {error ? (
          <>
            <Text style={{ fontFamily: type.uiBold, fontSize: 14, color: c.error }}>{error.title}</Text>
            <Text style={{ fontFamily: type.ui, fontSize: 13, color: c.muted }}>{error.message}</Text>
            {onRetry && (
              <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try loading this week's stats again" style={styles.retry}>
                <Text style={{ fontFamily: type.uiHeavy, fontSize: 13, color: c.primary }}>Try again</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <View style={styles.unitTop}>
              <Text style={{ fontFamily: type.heading, fontSize: 22, color: c.ink }}>
                {total}
                <Text style={{ fontFamily: type.uiBold, fontSize: 13, color: c.muted }}> min</Text>
              </Text>
              <Text style={{ fontFamily: type.uiBold, fontSize: 12, color: c.muted }}>practised so far</Text>
            </View>
            <View style={styles.week} accessibilityLabel={`Minutes practised this week: ${days.map((d) => `${d.label} ${d.minutes}`).join(', ')}`}>
              {days.map((d) => (
                <View key={d.key} style={styles.dayCol}>
                  <View style={[styles.dayTrack, { backgroundColor: c.trackOnCard }]}>
                    <View
                      style={[
                        styles.dayFill,
                        { height: `${Math.max(d.minutes > 0 ? 12 : 0, (d.minutes / max) * 100)}%`, backgroundColor: d.isToday ? c.primary : c.green },
                      ]}
                    />
                  </View>
                  <Text style={{ fontFamily: type.uiHeavy, fontSize: 11, color: d.future ? c.idle : d.isToday ? c.primary : c.muted }}>
                    {d.label}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </SlabCard>
    </Animated.View>
  );
}

// ─── Action rows ───────────────────────────────────────────────────────────
interface ActionRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  tint: 'primary' | 'pink' | 'yellow' | 'green';
  title: string;
  subtitle: string;
  onPress: () => void;
  accessibilityHint?: string;
  index: number;
}

export function ActionRow({ icon, tint, title, subtitle, onPress, accessibilityHint, index }: ActionRowProps) {
  const { c, type } = useUi2Theme();
  const enter = useHomeEnter();
  const color = tint === 'primary' ? c.primary : tint === 'pink' ? c.pink : tint === 'yellow' ? c.yellow : c.green;
  return (
    <Animated.View entering={enter(7 + index)}>
      <Pressable
        onPress={() => {
          haptic('select');
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={accessibilityHint}
      >
        <SlabCard style={styles.unitRow}>
          <View style={[styles.pctTile, { backgroundColor: color }]}>
            <Ionicons name={icon} size={18} color={tint === 'yellow' ? '#23203A' : '#FFFFFF'} />
          </View>
          <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: type.uiHeavy, fontSize: 15, color: c.ink }}>{title}</Text>
            <Text style={{ fontFamily: type.uiBold, fontSize: 12, color: c.muted }} numberOfLines={1}>{subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.idle} />
        </SlabCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  unitTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  pctTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  skeleton: { height: 12, borderRadius: 6 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  dailyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  dayCol: { flex: 1, alignItems: 'center', gap: 6 },
  dayTrack: { width: '100%', height: 56, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  dayFill: { width: '100%', borderRadius: 6 },
});
