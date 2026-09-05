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
import { colors, typography } from '../../config/theme';
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

// Unit tiles cycle this palette so adjacent units stay distinguishable.
const GRADIENT_PALETTE: [string, string][] = [
  ['#4F8EF7', '#7C3AED'],
  ['#A855F7', '#EC4899'],
  ['#22C55E', '#38BDF8'],
  ['#FFB547', '#FF6B6B'],
  ['#38BDF8', '#6366F1'],
  ['#F472B6', '#A855F7'],
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
    <View style={styles.progressWrap} onLayout={onLayout}>
      {progressPct > 0 && (
        <Animated.View pointerEvents="none" style={[styles.halo, fillWidth, haloStyle]}>
          <LinearGradient
            colors={['transparent', gradientColors[0], 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      <View style={styles.swatchTrack}>
        {progressPct > 0 && (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.swatchFill, fillWidth]}
          >
            {animate && trackWidth > 0 && (
              <AnimatedLinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.shimmer, shimmerStyle]}
              />
            )}
          </LinearGradient>
        )}
      </View>
    </View>
  );
}

function Tile({ tile }: { tile: LessonTileData }) {
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
      style={styles.tile}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tile.title} · ${meta} · ${Math.round(progressPct)} percent complete`}
    >
      <MagazineGlassCard>
        {/* Progress bar — empty track when no lessons started, gradient
            fill scales with tile.progress. Replaces the old decorative
            gradient swatch so the top-of-tile bar carries real signal. */}
        <ProgressGlow progressPct={progressPct} gradientColors={tile.gradientColors} />
        <Text style={styles.tileTitle} numberOfLines={1}>
          {tile.title}
        </Text>
        <Text style={styles.tileMeta}>{meta}</Text>
      </MagazineGlassCard>
    </Pressable>
  );
}

export function LessonTileGrid({ tiles, loading, error, onRetry }: LessonTileGridProps) {
  // Fetch failed with nothing cached — show a "couldn't load" card instead of
  // silently collapsing the section (which reads as "no lessons").
  if (!loading && error && (!tiles || tiles.length === 0)) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Continue learning</Text>
        <MagazineGlassCard>
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={colors.error.base} />
            <Text style={styles.errorText}>Couldn't load your lessons.</Text>
          </View>
          {onRetry && (
            <Pressable
              onPress={onRetry}
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Retry loading lessons"
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          )}
        </MagazineGlassCard>
      </View>
    );
  }

  if (loading && !tiles) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Continue learning</Text>
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.tile}>
              <MagazineGlassCard>
                <View style={styles.progressWrap}>
                  <View style={styles.swatchTrack} />
                </View>
                <View style={styles.skeletonLine} />
                <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
              </MagazineGlassCard>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!tiles || tiles.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Continue learning</Text>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Tile key={tile.id} tile={tile} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: serifFont,
    fontSize: 18,
    color: colors.text.primary,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    color: colors.text.primary,
    marginBottom: 2,
  },
  tileMeta: {
    fontFamily: typography.family.mono,
    fontSize: 11,
    color: colors.text.tertiary,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    color: colors.error.base,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  retryText: {
    fontFamily: typography.family.semibold,
    fontSize: 13,
    color: colors.indigo[400],
  },
});
