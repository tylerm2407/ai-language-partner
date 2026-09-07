import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MagazineGlassCard } from './MagazineGlassCard';
import { typography, ui2Dark, ui2Light, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { useMotion } from '../../hooks/useMotion';
import type { UnitProgressTile } from '../../lib/supabase-queries';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// ─── Progress-bar glow ─────────────────────────────────────────────────────
// Two slow loops layered on the gradient fill:
//   - a halo under the track (a vertical gradient fading to transparent, no
//     shadow — the design system keeps cards flat and Android would not colour
//     a shadow anyway) that breathes between the two opacities below;
//   - a narrow highlight that sweeps left→right across the filled portion,
//     rests, and sweeps again.
// Both gate on Reduce Motion and on the tab being focused, for the same reason
// GlowBackground does: backgrounded tabs stay mounted, and eight tiles' worth
// of loops running behind another screen is wasted GPU for the whole session.
const HALO_BREATHE_MS = 2600;
const HALO_OPACITY = [0.45, 1] as const;
const SHIMMER_SWEEP_MS = 1400;
const SHIMMER_REST_MS = 2200;
const SHIMMER_WIDTH_FRACTION = 0.6;

export interface LessonTileData {
  id: string;
  title: string;
  lessonCount: number;
  completedCount: number;
  progress: number;
  nextLessonId: string | null;
  gradientColors: [string, string];
}

interface LessonTileGridProps {
  tiles?: LessonTileData[] | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

// Editorial face. Fraunces_600SemiBold carries its own weight — never pair it
// with fontWeight, which makes Android synthesize a second bolding pass.
const serifFont = typography.family.serif;

/**
 * Unit tiles cycle this palette so adjacent units stay distinguishable. Built
 * from the UI 2.0 accent hues rather than a private list of hex.
 *
 * It reads one scheme (`ui2Light`) on purpose, and that is not the mistake it
 * looks like: these are saturated FILLS with no text on them, and three of the
 * four hues are identical in both schemes anyway — only `primary` moves, by one
 * step. Making a unit's identity colour change when the phone flips to dark
 * would be worse than the step. It is also assigned by
 * `unitTilesToLessonTiles`, which runs outside a component and so has no
 * scheme to read.
 */
const ACCENT = ui2Light;
const GRADIENT_PALETTE: [string, string][] = [
  [ACCENT.primary, ACCENT.pink],
  [ACCENT.pink, ACCENT.yellow],
  [ACCENT.green, ACCENT.primary],
  [ACCENT.yellow, ACCENT.pink],
  [ACCENT.primary, ACCENT.green],
  [ACCENT.green, ACCENT.yellow],
];

export function unitTilesToLessonTiles(units: UnitProgressTile[]): LessonTileData[] {
  return units.map((unit, i) => ({
    id: unit.unitId,
    title: unit.title,
    lessonCount: unit.lessonCount,
    completedCount: unit.completedCount,
    progress: unit.progress,
    nextLessonId: unit.nextLessonId,
    gradientColors: GRADIENT_PALETTE[i % GRADIENT_PALETTE.length],
  }));
}

function ProgressGlow({
  progressPct,
  gradientColors,
}: {
  progressPct: number;
  gradientColors: [string, string];
}) {
  const { scheme } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const isFocused = useIsFocused();
  const animate = !shouldReduce && isFocused && progressPct > 0;

  const [trackWidth, setTrackWidth] = useState(0);
  const halo = useSharedValue<number>(HALO_OPACITY[0]);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      // Assigning does not stop an in-flight withRepeat — cancel first.
      cancelAnimation(halo);
      cancelAnimation(sweep);
      halo.value = HALO_OPACITY[0];
      sweep.value = 0;
      return;
    }
    halo.value = withRepeat(
      withSequence(
        withTiming(HALO_OPACITY[1], { duration: HALO_BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
        withTiming(HALO_OPACITY[0], { duration: HALO_BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    sweep.value = 0;
    sweep.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SHIMMER_SWEEP_MS, easing: Easing.inOut(Easing.cubic) }),
        withDelay(SHIMMER_REST_MS, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(halo);
      cancelAnimation(sweep);
    };
  }, [animate, halo, sweep]);

  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value }));
  const shimmerStyle = useAnimatedStyle(() => {
    const shimmerWidth = trackWidth * SHIMMER_WIDTH_FRACTION;
    // Start fully off the left edge, end fully off the right edge of the track.
    const travel = trackWidth + shimmerWidth;
    return {
      width: shimmerWidth,
      transform: [{ translateX: -shimmerWidth + sweep.value * travel }],
    };
  });

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);
  const fillWidth = { width: `${progressPct}%` } as const;

  return (
    <View style={themed[scheme].progressWrap} onLayout={onLayout}>
      {progressPct > 0 && (
        <Animated.View pointerEvents="none" style={[themed[scheme].halo, fillWidth, haloStyle]}>
          <LinearGradient
            colors={['transparent', gradientColors[0], 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      <View style={themed[scheme].swatchTrack}>
        {progressPct > 0 && (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[themed[scheme].swatchFill, fillWidth]}
          >
            {animate && trackWidth > 0 && (
              <AnimatedLinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[themed[scheme].shimmer, shimmerStyle]}
              />
            )}
          </LinearGradient>
        )}
      </View>
    </View>
  );
}

function Tile({ tile }: { tile: LessonTileData }) {
  const { scheme } = useUi2Theme();
  const router = useRouter();
  const isComplete = tile.progress >= 1 && tile.lessonCount > 0;
  const meta = isComplete
    ? `Completed · ${tile.lessonCount} lessons`
    : tile.completedCount > 0
      ? `${tile.completedCount}/${tile.lessonCount} lessons`
      : `${tile.lessonCount} lessons`;

  const onPress = () => {
    if (tile.nextLessonId) {
      router.push(`/learn/${tile.nextLessonId}` as any);
    } else {
      router.push('/learn' as any);
    }
  };

  const progressPct = Math.min(Math.max(tile.progress, 0), 1) * 100;

  return (
    <Pressable
      style={themed[scheme].tile}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tile.title} · ${meta} · ${Math.round(progressPct)} percent complete`}
    >
      <MagazineGlassCard>
        {/* Progress bar — empty track when no lessons started, gradient
            fill scales with tile.progress. Replaces the old decorative
            gradient swatch so the top-of-tile bar carries real signal. */}
        <ProgressGlow progressPct={progressPct} gradientColors={tile.gradientColors} />
        <Text style={themed[scheme].tileTitle} numberOfLines={1}>
          {tile.title}
        </Text>
        <Text style={themed[scheme].tileMeta}>{meta}</Text>
      </MagazineGlassCard>
    </Pressable>
  );
}

export function LessonTileGrid({ tiles, loading, error, onRetry }: LessonTileGridProps) {
  const { c, scheme } = useUi2Theme();

  // Fetch failed with nothing cached — show a "couldn't load" card instead of
  // silently collapsing the section (which reads as "no lessons").
  if (!loading && error && (!tiles || tiles.length === 0)) {
    return (
      <View style={themed[scheme].section}>
        <Text style={themed[scheme].sectionTitle}>Continue learning</Text>
        <MagazineGlassCard>
          <View style={themed[scheme].errorRow}>
            <Ionicons name="alert-circle" size={16} color={c.error} />
            <Text style={themed[scheme].errorText}>Couldn't load your lessons.</Text>
          </View>
          {onRetry && (
            <Pressable
              onPress={onRetry}
              style={themed[scheme].retryButton}
              accessibilityRole="button"
              accessibilityLabel="Retry loading lessons"
            >
              <Text style={themed[scheme].retryText}>Try again</Text>
            </Pressable>
          )}
        </MagazineGlassCard>
      </View>
    );
  }

  if (loading && !tiles) {
    return (
      <View style={themed[scheme].section}>
        <Text style={themed[scheme].sectionTitle}>Continue learning</Text>
        <View style={themed[scheme].grid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={themed[scheme].tile}>
              <MagazineGlassCard>
                <View style={themed[scheme].progressWrap}>
                  <View style={themed[scheme].swatchTrack} />
                </View>
                <View style={themed[scheme].skeletonLine} />
                <View style={[themed[scheme].skeletonLine, themed[scheme].skeletonLineShort]} />
              </MagazineGlassCard>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!tiles || tiles.length === 0) return null;

  return (
    <View style={themed[scheme].section}>
      <Text style={themed[scheme].sectionTitle}>Continue learning</Text>
      <View style={themed[scheme].grid}>
        {tiles.map((tile) => (
          <Tile key={tile.id} tile={tile} />
        ))}
      </View>
    </View>
  );
}

const makeStyles = (c: Ui2Palette) =>
  StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: serifFont,
    fontSize: 18,
    color: c.ink,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '47%',
    flexGrow: 1,
  },
  progressWrap: {
    marginBottom: 12,
  },
  swatchTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.track,
    overflow: 'hidden',
  },
  swatchFill: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  /** Soft colour bleed above and below the fill. Sits under the track (paint
   *  order) and is taller than it so the fade reads as light, not as a box. */
  halo: {
    position: 'absolute',
    top: -7,
    left: 0,
    height: 20,
    borderRadius: 10,
    opacity: HALO_OPACITY[0],
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  tileTitle: {
    fontFamily: typography.family.semibold,
    fontSize: 15,
    color: c.ink,
    marginBottom: 2,
  },
  tileMeta: {
    fontFamily: typography.family.mono,
    fontSize: 11,
    color: c.muted,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 4,
    backgroundColor: c.track,
    marginBottom: 6,
  },
  skeletonLineShort: {
    width: '40%',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    fontFamily: typography.family.regular,
    fontSize: 13,
    color: c.error,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  retryText: {
    fontFamily: typography.family.semibold,
    fontSize: 13,
    color: c.primary,
  },
  });

/** Both schemes built once at module load — see DateLabel for why. */
const themed = { light: makeStyles(ui2Light), dark: makeStyles(ui2Dark) } as const;
