/**
 * Home, UI 2.0 — the top of the page: masthead, level + due cards, the
 * session hero, and today's read. Pure presentation; app/(app)/index.tsx
 * owns the data and routing.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../SlabCard';
import { SlabButton } from '../SlabButton';
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
  return (
    <Animated.View entering={enter(1)} style={styles.statRow}>
      <SlabCard
        tint="primary"
        style={styles.levelCard}
        accessibilityRole="text"
        accessibilityLabel={`Level ${band}. ${cefrCanDo(band)}`}
      >
        <View style={styles.levelTop}>
          <Text style={{ fontFamily: type.heading, fontSize: 30, lineHeight: 32, color: c.onTint }}>{band}</Text>
          <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.onTint }]}>Level</Text>
        </View>
        <Text style={{ fontFamily: type.ui, fontSize: 12, lineHeight: 16, color: c.muted }} numberOfLines={3}>
          {cefrCanDo(band)}
        </Text>
      </SlabCard>

      <Pressable
        onPress={() => {
          haptic('select');
          onReview();
        }}
        disabled={dueCount === 0}
        accessibilityRole="button"
        accessibilityLabel={dueCount > 0 ? `Review ${dueCount} cards due` : 'No cards due'}
        style={styles.dueCard}
      >
        <SlabCard tint="green" style={styles.dueInner}>
          <View style={[styles.iconTile, { backgroundColor: c.green }]}>
            <Ionicons name="albums-outline" size={18} color="#FFFFFF" />
          </View>
          <View>
            <Text style={{ fontFamily: type.heading, fontSize: 26, lineHeight: 28, color: c.ink }}>{dueCount}</Text>
            <Text style={{ fontFamily: type.uiBold, fontSize: 12, color: c.muted }}>
              {dueCount === 1 ? 'card due' : 'cards due'}
            </Text>
          </View>
        </SlabCard>
      </Pressable>
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
          <SlabButton label="Start" variant="onPrimary" onPress={onStart} style={styles.heroCta} />
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
        accessibilityLabel={`${label}. ${body}`}
      >
        <SlabCard tint="yellow" style={styles.readRow}>
          <View style={[styles.iconTile, { backgroundColor: c.yellow }]}>
            <Ionicons name={hasRead ? 'checkmark' : 'book-outline'} size={18} color="#23203A" />
          </View>
          <View style={styles.readText}>
            <Text style={{ fontFamily: type.uiHeavy, fontSize: 14, color: c.ink }}>{label}</Text>
            <Text style={{ fontFamily: type.uiBold, fontSize: 12, color: c.muted }} numberOfLines={1}>
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
  statRow: { flexDirection: 'row', gap: 12 },
  levelCard: { flex: 1.4, gap: 8, padding: 14 },
  levelTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  dueCard: { flex: 1 },
  dueInner: { flex: 1, justifyContent: 'space-between', gap: 10, padding: 14 },
  iconTile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: 20, gap: 12 },
  heroBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroCta: { minWidth: 104 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  readText: { flex: 1, gap: 1, minWidth: 0 },
});
