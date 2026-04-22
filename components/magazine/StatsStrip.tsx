import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAppStore } from '../../stores/useAppStore';
import { useHearts } from '../../hooks/useHearts';
import { colors, typography, radii } from '../../config/theme';

function Pill({ emoji, value, color }: { emoji: string; value: number | string; color: string }) {
  const inner = (
    <>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </>
  );

  if (Platform.OS === 'android') {
    return (
      <View style={[styles.pill, styles.pillFallback]}>
        {inner}
      </View>
    );
  }

  return (
    <View style={styles.pill}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.pillContent}>
        {inner}
      </View>
    </View>
  );
}

export function StatsStrip() {
  const profile = useAppStore((s) => s.profile);
  const { hearts, isUnlimited } = useHearts();

  const streak = profile?.streak ?? 0;
  const totalXp = profile?.totalXp ?? 0;

  return (
    <View style={styles.row}>
      <Pill emoji="🔥" value={streak} color={colors.magazine.streakFlame} />
      <Pill emoji="⚡" value={totalXp} color={colors.magazine.xpGold} />
      <Pill emoji="❤️" value={isUnlimited ? '∞' : hearts} color={colors.magazine.heartsCoral} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 0.5,
    borderColor: colors.magazine.glassBorder,
    overflow: 'hidden',
    height: 34,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.magazine.glassBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillFallback: {
    backgroundColor: colors.magazine.glassBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emoji: {
    fontSize: 14,
    marginRight: 4,
  },
  value: {
    fontFamily: typography.family.monoMedium,
    fontSize: 14,
  },
});
