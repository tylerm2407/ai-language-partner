/**
 * Home, UI 2.0 — the top of the page: masthead, the level card, the
 * session hero, and today's read. Pure presentation; app/(app)/index.tsx
 * owns the data and routing.
 *
 * S1 · Quiet (canvas "Home · logo colours", picked 2026-09-10): one neutral
 * card fill, no icon wells, and the app icon's colour ramp only as thin
 * lines. Cards due folds into the level card as one tappable line — the same
 * route to review it had as a tile. The hero stays solid violet; its Start
 * is the logo's cyan.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../SlabCard';
import { SlabButton } from '../SlabButton';
import { RampMark, RampRule } from '../BrandRamp';
import { haptic } from '../../../lib/haptics';
import { cefrCanDo } from '../../../lib/cefr-labels';
import { useMotion } from '../../../hooks/useMotion';
import { useUi2Theme } from '../../../hooks/useUi2Theme';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Entrance for the i-th block on the page. */
export function useHomeEnter() {
  const { shouldReduce } = useMotion();
  return (i: number) => (shouldReduce ? undefined : FadeInDown.delay(60 + i * 50).duration(340));
}

// ─── Masthead ──────────────────────────────────────────────────────────────
export function HomeHeader({ greeting, name }: { greeting: string; name?: string | null }) {
  const { c, type } = useUi2Theme();
  const enter = useHomeEnter();
  const now = new Date();
  return (
    <Animated.View entering={enter(0)} style={styles.header}>
      <Text
        accessibilityRole="header"
        style={{ fontFamily: type.heading, fontSize: 34, lineHeight: 38, letterSpacing: -0.6, color: c.ink }}
      >
        {greeting}
        {name ? `, ${name}` : ''}
      </Text>
      <Text style={{ fontFamily: type.uiBold, fontSize: 14, color: c.muted }}>
        {DAYS[now.getDay()]}, {MONTHS[now.getMonth()]} {now.getDate()}
      </Text>
    </Animated.View>
  );
}

// ─── Level + due ───────────────────────────────────────────────────────────
interface LevelDueRowProps {
  band: string;
  dueCount: number;
  onReview: () => void;
}

export function LevelDueRow({ band, dueCount, onReview }: LevelDueRowProps) {
  const { c, type } = useUi2Theme();
  const enter = useHomeEnter();
  const dueLabel = dueCount === 0 ? 'No cards due' : `${dueCount} ${dueCount === 1 ? 'card' : 'cards'} due`;
  return (
    <Animated.View entering={enter(1)}>
      <SlabCard style={styles.levelCard}>
        <View style={styles.levelTop}>
          <View
            style={styles.levelBand}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Level ${band}. ${cefrCanDo(band)}`}
          >
            <Text style={{ fontFamily: type.heading, fontSize: 34, lineHeight: 36, color: c.ink }}>{band}</Text>
            <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.muted }]}>Level</Text>
          </View>
          <Pressable
            onPress={() => {
              haptic('select');
              onReview();
            }}
            disabled={dueCount === 0}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={dueCount > 0 ? `Review ${dueLabel}` : dueLabel}
            style={styles.dueLink}
          >
            <Text style={{ fontFamily: type.uiHeavy, fontSize: 13, color: dueCount > 0 ? c.primary : c.muted }}>{dueLabel}</Text>
          </Pressable>
        </View>
        {/* The ramp as a rule, not a bar: Home has no measured "% to the next
            band" yet, so the line carries the brand and claims nothing. */}
        <RampRule />
        <Text style={{ fontFamily: type.uiBold, fontSize: 13, lineHeight: 17, color: c.muted }} numberOfLines={3} importantForAccessibility="no">
          {cefrCanDo(band)}
        </Text>
      </SlabCard>
    </Animated.View>
  );
}

// ─── Session hero ──────────────────────────────────────────────────────────
interface SessionHeroProps {
  title: string;
  minutes: number;
  subtitle: string;
  onStart: () => void;
}

export function SessionHero({ title, minutes, subtitle, onStart }: SessionHeroProps) {
  const { c, type, shape } = useUi2Theme();
  const enter = useHomeEnter();
  return (
    <Animated.View entering={enter(2)}>
      <View
        style={[
          styles.hero,
          { backgroundColor: c.primary, borderBottomColor: c.slab, borderBottomWidth: shape.buttonSlab, borderRadius: shape.radiusHero },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`Today's session, ${minutes} minutes: ${title}`}
      >
        <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.onPrimaryMuted }]}>
          Today's session · {minutes} min
        </Text>
        <Text style={{ fontFamily: type.heading, fontSize: 26, lineHeight: 30, color: c.onPrimary }} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.heroBottom}>
          <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.onPrimaryMuted, flex: 1 }} numberOfLines={2}>
            {subtitle}
          </Text>
          <SlabButton label="Start" variant="brand" onPress={onStart} style={styles.heroCta} />
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Today's read ──────────────────────────────────────────────────────────
interface ReadRowProps {
  title: string | null;
  minutes: number | null;
  loading: boolean;
  error: string | null;
  hasRead: boolean;
  onPress: () => void;
}

export function ReadRow({ title, minutes, loading, error, hasRead, onPress }: ReadRowProps) {
  const { c, type } = useUi2Theme();
  const enter = useHomeEnter();
  const label = loading ? 'Loading today’s read' : error ? 'Today’s read could not load' : `Today's read${minutes ? ` · ${minutes} min` : ''}`;
  const body = loading ? '…' : error ? error : title ?? 'Nothing published yet today';
  return (
    <Animated.View entering={enter(3)}>
      <Pressable
        onPress={() => {
          haptic('select');
          onPress();
        }}
        disabled={!title || loading}
        accessibilityRole="button"
        accessibilityLabel={`${label}${hasRead ? ', read' : ''}. ${body}`}
      >
        <SlabCard style={styles.readRow}>
          <RampMark />
          <View style={styles.readText}>
            <View style={styles.readTitle}>
              <Text style={{ fontFamily: type.uiHeavy, fontSize: 15, color: c.ink }}>{label}</Text>
              {hasRead ? <Ionicons name="checkmark-circle" size={16} color={c.logoSky} accessibilityLabel="Read" /> : null}
            </View>
            <Text style={{ fontFamily: type.uiBold, fontSize: 13, color: c.muted }} numberOfLines={1}>
              {body}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.idle} />
        </SlabCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  eyebrow: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  levelCard: { gap: 12, padding: 16 },
  levelTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  levelBand: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  dueLink: { minHeight: 44, justifyContent: 'center' },
  hero: { padding: 20, gap: 12 },
  heroBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroCta: { minWidth: 104 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  readText: { flex: 1, gap: 1, minWidth: 0 },
  readTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
