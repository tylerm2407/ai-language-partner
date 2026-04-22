import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MagazineGlassCard } from './MagazineGlassCard';
import { colors, typography, radii } from '../../config/theme';

interface LessonTileData {
  id: string;
  title: string;
  lessonCount: number;
  progress: number; // 0-1
  gradientColors: [string, string];
}

interface LessonTileGridProps {
  tiles?: LessonTileData[];
}

const serifFont = Platform.select({ ios: 'Georgia', default: 'serif' });

// Default tiles when no real data is available
const DEFAULT_TILES: LessonTileData[] = [
  { id: '1', title: 'Greetings', lessonCount: 5, progress: 0.6, gradientColors: ['#4F8EF7', '#7C3AED'] },
  { id: '2', title: 'Food & Drink', lessonCount: 8, progress: 0.2, gradientColors: ['#A855F7', '#EC4899'] },
  { id: '3', title: 'Travel', lessonCount: 6, progress: 0, gradientColors: ['#22C55E', '#38BDF8'] },
  { id: '4', title: 'Daily Life', lessonCount: 7, progress: 0, gradientColors: ['#FFB547', '#FF6B6B'] },
];

function Tile({ tile }: { tile: LessonTileData }) {
  const router = useRouter();

  return (
    <Pressable
      style={styles.tile}
      onPress={() => router.push('/learn' as any)}
      accessibilityRole="button"
      accessibilityLabel={`${tile.title} - ${tile.lessonCount} lessons`}
    >
      <MagazineGlassCard>
        {/* Gradient swatch */}
        <LinearGradient
          colors={tile.gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.swatch}
        />
        <Text style={styles.tileTitle}>{tile.title}</Text>
        <Text style={styles.tileMeta}>{tile.lessonCount} lessons</Text>
        {tile.progress > 0 && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${tile.progress * 100}%` }]} />
          </View>
        )}
      </MagazineGlassCard>
    </Pressable>
  );
}

export function LessonTileGrid({ tiles = DEFAULT_TILES }: LessonTileGridProps) {
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
  swatch: {
    height: 6,
    borderRadius: 3,
    marginBottom: 12,
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
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.magazine.accentBlue,
    borderRadius: 2,
  },
});
