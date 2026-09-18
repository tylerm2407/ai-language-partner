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
 *
 * Clay (canvas "Fluenci Home · Depth", board 4, picked 2026-09-16): every
 * card on Home is a soft clay volume on the lilac `clayGround` (`SlabCard
 * clay`, `useClay`). The masthead is a lilac gradient shelf with the mascot sitting
 * on its bottom edge; level and due are two equal clay cards; the hero keeps
 * its mesh — `primary` with a highlight stop top-right, a shade stop
 * bottom-left, a soft white disc and an amber glow, all SVG — under a clay
 * light and shade. Solid pills and tiles are `useClay().raised`, grooves
 * `useClay().well`. Sections, order and copy did not move.
 */
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ClayOverlay, SlabCard, useClay } from '../SlabCard';
import { SlabButton } from '../SlabButton';
import { Ui2Mascot } from '../Ui2Mascot';
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
/**
 * `languageChip` is the switcher's handle (migration 133): the two-letter code
 * of the language the app is currently in, with a caret. It sits beside the
 * greeting — which is already spoken IN that language — so the chip reads as a
 * label for what the learner is looking at rather than a stray control. Absent
 * (null) it renders nothing, which is what a single-language account gets
 * until it has a second one to switch to.
 */
export function HomeHeader({
  greeting,
  name,
  languageChip,
  onSwitchLanguage,
}: {
  greeting: string;
  name?: string | null;
  languageChip?: string | null;
  onSwitchLanguage?: () => void;
}) {
  const { c, type } = useUi2Theme();
  const enter = useHomeEnter();
  const now = new Date();
  return (
    <Animated.View entering={enter(0)} style={[styles.header, { boxShadow: `0px 22px 36px -16px ${c.clayDrop}` }]}>
      {/* The shelf's colour is a gradient child, so its clay light and shade
          ride an overlay above it (see ClayOverlay). */}
      <LinearGradient
        colors={[c.clayShelfFrom, c.clayShelfTo]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: SHELF_RADIUS }]}
      />
      <ClayOverlay radius={SHELF_RADIUS} rim={c.clayRim} shade={c.clayShade} />
      <View style={styles.headerTop}>
        <Text style={{ fontFamily: type.uiHeavy, fontSize: 13, color: c.onTint, flex: 1 }} numberOfLines={1}>
          {DAYS[now.getDay()]}, {MONTHS[now.getMonth()]} {now.getDate()}
        </Text>
        {languageChip && onSwitchLanguage ? (
          <Pressable
            onPress={() => {
              haptic('buttonPress');
              onSwitchLanguage();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Language: ${languageChip}. Switch language`}
            style={[
              styles.langChip,
              {
                backgroundColor: c.clayCard,
                boxShadow: `inset 2px 2px 4px ${c.clayRim}, inset -3px -3px 6px ${c.clayShade}, 0px 4px 8px -4px ${c.clayDrop}`,
              },
            ]}
          >
            <Text style={{ fontFamily: type.uiBold, fontSize: 13, color: c.onTint, letterSpacing: 0.5 }}>
              {languageChip}
            </Text>
            <Ionicons name="chevron-down" size={14} color={c.onTint} />
          </Pressable>
        ) : null}
      </View>
      {/* Held clear of the mascot, which stands in the shelf's bottom-right corner. */}
      <Text
        accessibilityRole="header"
        style={{ fontFamily: type.heading, fontSize: 36, lineHeight: 40, letterSpacing: -1, color: c.ink, maxWidth: '64%' }}
      >
        {greeting}
        {name ? `, ${name}` : ''}
      </Text>
      <View
        pointerEvents="none"
        style={styles.sol}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ui2Mascot size={MASCOT_SIZE} />
      </View>
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
  /**
   * The report's disclosure when rungs under `band` were assumed from the
   * learner's placement rather than measured ("Measured from your B1 work;
   * A1–A2 assumed from your placement."). Null or omitted renders nothing.
   */
  basis?: string | null;
  dueCount: number;
  onReview: () => void;
  /** Opens the CEFR explainer. The card is the badge the question is asked of. */
  onExplain?: () => void;
}

/**
 * The eyebrow beside the ring. Pure so the four states are asserted.
 *
 * Unmeasured is its own state, not a variant of measured. Before this, a
 * learner placed at A2 with nothing proven yet read "A2" inside the ring and
 * "15% to A2" beside it — the same band twice, one of them a claim the
 * report had not made. "Proving A2" says what the ring is actually counting:
 * the work that turns the placement into a measured level.
 */
export function levelEyebrow(
  nextBand: string | null,
  progressPercent: number | null,
  measured: boolean,
): string {
  // The band itself sits inside the ring, so the eyebrow spends its ~110pt on
  // the progress, not on the word "Level" — that word is in the a11y label.
  if (progressPercent === null) return 'Level';
  if (nextBand === null) return 'Top band';
  if (!measured) return `Proving ${nextBand} · ${progressPercent}%`;
  return `${progressPercent}% to ${nextBand}`;
}

export function LevelDueRow({ band, nextBand, progressPercent, measured, basis, dueCount, onReview, onExplain }: LevelDueRowProps) {
  const { c, type, scheme } = useUi2Theme();
  const clay = useClay();
  const enter = useHomeEnter();
  const eyebrow = levelEyebrow(nextBand, progressPercent, measured);
  const ringPct = progressPercent === null ? 0 : progressPercent / 100;
  const dueLabel = dueCount === 1 ? 'card due' : 'cards due';
  return (
    <Animated.View entering={enter(1)} style={styles.statRow}>
      {/* The card is the badge the "what does B1 mean?" question is asked of,
          so tapping it answers. The progressbar role stays on the card; the
          wrapper is the button. */}
      <Pressable
        onPress={onExplain}
        disabled={!onExplain}
        style={styles.levelPress}
        accessibilityRole="button"
        accessibilityLabel="What is a CEFR level?"
        accessibilityHint="Explains the A1 to C2 scale"
      >
        <SlabCard
          clay
          style={styles.levelCard}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${measured ? 'Measured level' : 'Placed at'} ${band}${measured ? '' : ', not yet measured'}. ${cefrCanDo(band)}.${basis ? ` ${basis}` : ''}`}
          accessibilityValue={
            progressPercent === null
              ? undefined
              : {
                  min: 0,
                  max: 100,
                  now: progressPercent,
                  text: !nextBand
                    ? 'Top band'
                    : measured
                      ? `${progressPercent} percent of the way to ${nextBand}`
                      : `${progressPercent} percent of the way to proving ${nextBand}`,
                }
          }
        >
          <View style={styles.levelTop}>
            {/* The ring sits in a shallow clay bowl pressed into the card. */}
            <View style={[styles.ringBowl, { backgroundColor: c.primaryTint }, clay.bowl]}>
              <ProgressRing
                pct={ringPct}
                size={52}
                stroke={6}
                color={c.primary}
                track={scheme === 'dark' ? c.primaryTintBorder : c.trackOnCard}
              >
                <Text style={{ fontFamily: type.heading, fontSize: 15, lineHeight: 18, color: c.onTint }}>{band}</Text>
              </ProgressRing>
            </View>
            <Text
              style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.onTint, fontSize: 10, lineHeight: 13, letterSpacing: 0.6, flex: 1 }]}
              numberOfLines={2}
            >
              {eyebrow}
            </Text>
          </View>
          <View style={styles.levelText}>
            <Text style={{ fontFamily: type.ui, fontSize: 12, lineHeight: 16, color: c.muted }} numberOfLines={3}>
              {cefrCanDo(band)}
            </Text>
            {basis ? (
              // The can-do line above is what keeps the band from standing bare;
              // this is the honesty line under it, and it stays one line so the
              // card's height does not swing with the disclosure.
              <Text style={{ fontFamily: type.ui, fontSize: 11, lineHeight: 14, color: c.muted }} numberOfLines={1}>
                {basis}
              </Text>
            ) : null}
          </View>
        </SlabCard>
      </Pressable>

      <SlabCard clay style={styles.dueInner}>
        <View>
          <Text style={{ fontFamily: type.heading, fontSize: 34, lineHeight: 38, color: c.ink }}>{dueCount}</Text>
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
          style={[styles.reviewPill, dueCount > 0 ? clay.raised(c.green) : { backgroundColor: c.greenBorder }]}
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
export function ProgressRing({ pct, size = RING_SIZE, stroke = RING_STROKE, color, track, trackOpacity = 1, children }: ProgressRingProps) {
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

/**
 * The hero's atmosphere: two radial stops that turn the flat violet into a
 * mesh, a large soft white disc off the top-right corner and an amber glow off
 * the bottom-left. Absolute, clipped by the hero's radius, never announced.
 * Sized for the widest hero a phone shows; the disc and glow hang off the
 * edges by design, so a wider card just shows more of them.
 */
function HeroMesh() {
  const { c } = useUi2Theme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 350 240" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="hero-hi" cx="100%" cy="0%" r="90%">
            <Stop offset="0" stopColor={c.heroHighlight} stopOpacity={1} />
            <Stop offset="0.55" stopColor={c.heroHighlight} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="hero-lo" cx="0%" cy="100%" r="80%">
            <Stop offset="0" stopColor={c.heroShade} stopOpacity={1} />
            <Stop offset="0.6" stopColor={c.heroShade} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="hero-amber" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c.yellow} stopOpacity={0.3} />
            <Stop offset="1" stopColor={c.yellow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="350" height="240" fill="url(#hero-hi)" />
        <Rect x="0" y="0" width="350" height="240" fill="url(#hero-lo)" />
        <Circle cx="390" cy="10" r="130" fill={c.onPrimary} fillOpacity={0.14} />
        <Circle cx="30" cy="240" r="110" fill="url(#hero-amber)" />
      </Svg>
    </View>
  );
}

/** The hero's clay light and shade, over the violet mesh. Fixed rather than
 *  per-scheme: they sit on `primary`, which barely moves between schemes. */
const HERO_RIM = 'rgba(255,255,255,0.28)';
const HERO_SHADE = 'rgba(20,10,80,0.35)';
const START_CLAY = 'inset 2px 3px 5px rgba(255,255,255,1), inset -3px -4px 8px rgba(77,51,214,0.25), 0px 10px 18px -8px rgba(20,10,80,0.6)';

export function SessionHero({ title, minutesToday, goalMinutes, subtitle, onStart }: SessionHeroProps) {
  const { c, type, scheme } = useUi2Theme();
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
    // The drop shadow lives on the wrapper: the hero clips its mesh, and a
    // clipped view would clip its own shadow with it.
    <Animated.View
      entering={enter(2)}
      style={{
        borderRadius: HERO_RADIUS,
        boxShadow: `0px 24px 36px -16px ${scheme === 'dark' ? c.clayDrop : `${c.slab}B3`}`,
      }}
    >
      <View
        style={[styles.hero, { backgroundColor: c.primary, borderRadius: HERO_RADIUS }]}
        accessibilityRole="summary"
        accessibilityLabel={`Today's session: ${title}`}
      >
        <HeroMesh />
        <ClayOverlay radius={HERO_RADIUS} rim={HERO_RIM} shade={HERO_SHADE} />
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
          <SlabButton label="Start" variant="onPrimary" onPress={onStart} style={styles.heroCta} fillStyle={{ boxShadow: START_CLAY }} />
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
  const clay = useClay();
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
        <SlabCard clay style={styles.readRow}>
          <View style={[styles.iconTile, clay.raised(c.yellow)]}>
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

/** The mascot's size on the shelf, and the shelf's corner. */
const MASCOT_SIZE = 132;
const SHELF_RADIUS = 36;
const HERO_RADIUS = 34;

const styles = StyleSheet.create({
  // Wider than the page column by 8pt a side, so the shelf reads as the
  // screen's masthead rather than one more card. The mascot hangs 30pt below its
  // bottom edge and must paint over the level row, hence the zIndex.
  header: { gap: 10, marginHorizontal: -8, borderRadius: SHELF_RADIUS, padding: 20, paddingBottom: 44, zIndex: 2 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sol: { position: 'absolute', right: 14, bottom: -30 },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    // 32pt tall inside a 44pt hit area (hitSlop): the greeting is the tallest
    // thing on the row and a full-height pill beside it reads as a button bar.
    height: 32,
  },
  eyebrow: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  statRow: { flexDirection: 'row', gap: 14 },
  levelPress: { flex: 1 },
  levelCard: { flex: 1, gap: 10, padding: 16 },
  levelTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ringBowl: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  levelText: { gap: 4, minWidth: 0 },
  dueInner: { flex: 1, justifyContent: 'space-between', gap: 10, padding: 16 },
  reviewPill: { minHeight: 44, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  ringCentre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  iconTile: { width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: 20, gap: 14, overflow: 'hidden' },
  heroBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroCta: { minWidth: 104 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalText: { flex: 1, gap: 4 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  readText: { flex: 1, gap: 1, minWidth: 0 },
});
