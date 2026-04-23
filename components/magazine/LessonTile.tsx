import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MagazineGlassCard } from './MagazineGlassCard';
import { colors, typography } from '../../config/theme';
import type { UnitProgressTile } from '../../lib/supabase-queries';

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
}

const serifFont = Platform.select({ ios: 'Georgia', default: 'serif' });

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
        <View style={styles.swatchTrack}>
          {progressPct > 0 && (
            <LinearGradient
              colors={tile.gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.swatchFill, { width: `${progressPct}%` }]}
            />
          )}
        </View>
        <Text style={styles.tileTitle} numberOfLines={1}>
          {tile.title}
        </Text>
        <Text style={styles.tileMeta}>{meta}</Text>
      </MagazineGlassCard>
    </Pressable>
  );
}

export function LessonTileGrid({ tiles, loading }: LessonTileGridProps) {
  if (loading && !tiles) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Continue learning</Text>
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.tile}>
              <MagazineGlassCard>
                <View style={styles.swatchTrack} />
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
    fontWeight: '600',
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
  swatchTrack: {
    height: 6,
    borderRadius: 3,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  swatchFill: {
    height: '100%',
    borderRadius: 3,
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
});
