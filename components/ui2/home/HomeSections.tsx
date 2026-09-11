/**
 * Home, UI 2.0 — the top of the page: masthead, level + due cards, the
 * session hero, and today's read. Pure presentation; app/(app)/index.tsx
 * owns the data and routing.
 *
 * N3 · Ring (canvas "Home · standard, variations", picked 2026-09-11): the
 * level card carries a ring showing how far the learner is toward the next
 * band, and the cards-due tile is the Review button it always behaved as.
 * Both numbers are live — see hooks/useNextBandProgress and
 * hooks/useReviewCountSync — and the card never shows a percentage it does
 * not have: while the report loads the ring is empty and the eyebrow reads
 * "Level"; at C2 it reads "Top band" and the ring is full.
 */
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../SlabCard';
import { SlabButton } from '../SlabButton';
import { haptic } from '../../../lib/haptics';
import { cefrCanDo } from '../../../lib/cefr-labels';
import { displayMinutes, goalProgress } from '../../../lib/active-time';
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
  /** The band after this one; null at the top of the ladder. */
  nextBand: string | null;
  /** 0–99 toward `nextBand`, 100 at the top; null while unknown. */
  progressPercent: number | null;
  /** True when `band` is the measured assessment rather than the profile's claim. */
  measured: boolean;
  dueCount: number;
  onReview: () => void;
}

/** The eyebrow beside the ring. Pure so the three states are asserted. */
export function levelEyebrow(nextBand: string | null, progressPercent: number | null): string {
  // The band itself sits inside the ring, so the eyebrow spends its ~110pt on
  // the progress, not on the word "Level" — that word is in the a11y label.
  if (progressPercent === null) return 'Level';
  if (nextBand === null) return 'Top band';
  return `${progressPercent}% to ${nextBand}`;
}

export function LevelDueRow({ band, nextBand, progressPercent, measured, dueCount, onReview }: LevelDueRowProps) {
  const { c, type } = useUi2Theme();
  const enter = useHomeEnter();
  const eyebrow = levelEyebrow(nextBand, progressPercent);
  const ringPct = progressPercent === null ? 0 : progressPercent / 100;
  const dueLabel = dueCount === 1 ? 'card due' : 'cards due';
  return (
    <Animated.View entering={enter(1)} style={styles.statRow}>
      <SlabCard
        tint="primary"
        style={styles.levelCard}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${measured ? 'Measured level' : 'Level'} ${band}. ${cefrCanDo(band)}`}
        accessibilityValue={
          progressPercent === null
            ? undefined
            : { min: 0, max: 100, now: progressPercent, text: nextBand ? `${progressPercent} percent of the way to ${nextBand}` : 'Top band' }
        }
      >
        <View style={styles.levelRing}>
          <ProgressRing pct={ringPct} size={48} stroke={5} color={c.primary} track={c.primaryTintBorder}>
            <Text style={{ fontFamily: type.heading, fontSize: 15, lineHeight: 18, color: c.onTint }}>{band}</Text>
          </ProgressRing>
        </View>
        <View style={styles.levelText}>
          <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.onTint, fontSize: 11, letterSpacing: 0.6 }]} numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text style={{ fontFamily: type.ui, fontSize: 12, lineHeight: 16, color: c.muted }} numberOfLines={3}>
            {cefrCanDo(band)}
          </Text>
        </View>
      </SlabCard>

      <SlabCard tint="green" style={styles.dueInner}>
        <View>
          <Text style={{ fontFamily: type.heading, fontSize: 26, lineHeight: 28, color: c.ink }}>{dueCount}</Text>
          <Text style={{ fontFamily: type.uiBold, fontSize: 12, color: c.muted }}>{dueLabel}</Text>
        </View>
        <Pressable
          onPress={() => {
            haptic('select');
            onReview();
          }}
          disabled={dueCount === 0}
          accessibilityRole="button"
          accessibilityLabel={dueCount > 0 ? `Review ${dueCount} ${dueLabel}` : 'No cards due'}
          accessibilityState={{ disabled: dueCount === 0 }}
          style={[styles.reviewPill, { backgroundColor: dueCount > 0 ? c.green : c.greenBorder }]}
        >
          <Text style={{ fontFamily: type.uiHeavy, fontSize: 13, color: dueCount > 0 ? c.onGreen : c.muted }}>
            {dueCount > 0 ? 'Review' : 'Caught up'}
          </Text>
          {dueCount > 0 ? <Ionicons name="chevron-forward" size={14} color={c.onGreen} /> : null}
        </Pressable>
      </SlabCard>
    </Animated.View>
  );
}

// ─── Session hero ──────────────────────────────────────────────────────────

/** Default ring geometry. 56pt reads at a glance without crowding the hero. */
const RING_SIZE = 56;
const RING_STROKE = 6;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  /** 0–1. */
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
  /** The unfilled ring. */
  track: string;
  trackOpacity?: number;
  /** Drawn in the ring's centre. */
  children?: ReactNode;
}

/**
 * A 56pt ring that animates to `pct`. Two callers: the hero's daily goal (the
 * learner's own minutes against their own goal) and the level card's progress
 * to the next band.
 *
 * The goal ring used to be a label — "Today's session · 15 min" — that was
 * `daily_goal_minutes` printed and compared against nothing; `lib/active-time`
 * gave it a real numerator. Identical for every tier: a ring that behaved
 * differently on free would turn the learner's stated intention into an
 * upsell surface.
 */
function ProgressRing({ pct, size = RING_SIZE, stroke = RING_STROKE, color, track, trackOpacity = 1, children }: ProgressRingProps) {
  const { shouldReduce } = useMotion();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = useSharedValue(shouldReduce ? pct : 0);

  useEffect(() => {
    filled.value = shouldReduce ? pct : withTiming(pct, { duration: 600 });
  }, [pct, shouldReduce, filled]);

  const arc = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - filled.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} importantForAccessibility="no">
        {/* -90° so the arc grows from 12 o'clock rather than 3. */}
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeOpacity={trackOpacity} strokeWidth={stroke} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            animatedProps={arc}
          />
        </G>
      </Svg>
      {children ? <View style={styles.ringCentre}>{children}</View> : null}
    </View>
  );
}

interface SessionHeroProps {
  title: string;
  /** `daily_stats.minutes_practiced` for today. Fractional; formatted here. */
  minutesToday: number;
  /** `user_profiles.daily_goal_minutes`. */
  goalMinutes: number;
  subtitle: string;
  onStart: () => void;
}

export function SessionHero({ title, minutesToday, goalMinutes, subtitle, onStart }: SessionHeroProps) {
  const { c, type, shape } = useUi2Theme();
  const enter = useHomeEnter();

  const { pct, remainingMinutes, met } = goalProgress(minutesToday, goalMinutes);
  const done = displayMinutes(minutesToday);
  const goal = displayMinutes(goalMinutes);
  // `remainingMinutes` is 0 with `met` false only when there is no goal at all
  // (`goalProgress` refuses to invent one), which Home's default makes
  // unreachable — but "0 minutes to go" under a visibly empty ring is the kind
  // of line that ships, so it is spelled out rather than left to chance.
  const state = met
    ? 'Goal met'
    : remainingMinutes > 0
      ? `${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'} to go`
      : 'No daily goal set';
  const countLabel = `${done} of ${goal} min`;

  return (
    <Animated.View entering={enter(2)}>
      <View
        style={[
          styles.hero,
          { backgroundColor: c.primary, borderBottomColor: c.slab, borderBottomWidth: shape.buttonSlab, borderRadius: shape.radiusHero },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`Today's session: ${title}`}
      >
        <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.onPrimaryMuted }]}>
          Today's session
        </Text>
        <Text style={{ fontFamily: type.heading, fontSize: 26, lineHeight: 30, color: c.onPrimary }} numberOfLines={2}>
          {title}
        </Text>

        {/* One accessible group: the ring is decorative on its own, and the two
            lines beside it are what the ring means. */}
        <View
          style={styles.goal}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Daily goal"
          accessibilityValue={{ min: 0, max: goal, now: done, text: `${countLabel}. ${state}.` }}
        >
          <ProgressRing pct={pct} color={c.onPrimary} track={c.onPrimary} trackOpacity={0.24} />
          <View style={styles.goalText}>
            <Text style={{ fontFamily: type.heading, fontSize: 20, lineHeight: 24, color: c.onPrimary }}>
              {countLabel}
            </Text>
            <Text style={{ fontFamily: type.uiBold, fontSize: 13, lineHeight: 17, color: c.onPrimaryMuted }}>
              {state}
            </Text>
          </View>
        </View>

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
  levelCard: { flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  levelRing: { flexShrink: 0 },
  levelText: { flex: 1, gap: 4, minWidth: 0 },
  dueInner: { flex: 1, justifyContent: 'space-between', gap: 10, padding: 14 },
  reviewPill: { minHeight: 36, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  ringCentre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  iconTile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: 20, gap: 12 },
  heroBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroCta: { minWidth: 104 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalText: { flex: 1, gap: 4 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  readText: { flex: 1, gap: 1, minWidth: 0 },
});
