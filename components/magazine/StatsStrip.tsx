/**
 * StatsStrip — the streak / XP / hearts row under the Home greeting.
 *
 * Was: three emoji (🔥 ⚡ ❤️) in blurred glass pills with mono values. Now the
 * deck's StatsRow — two Chips with Ionicons plus the real HeartsDisplay, so the
 * row uses the same chip primitive and heart glyphs as the rest of the app
 * instead of a parallel emoji vocabulary.
 *
 * Streak and XP deliberately do NOT share a fill: streak.tint is orange,
 * warning.tint is amber.
 */

import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../stores/useAppStore';
import { useHearts } from '../../hooks/useHearts';
import { useAdultMode } from '../../hooks/useAdultMode';
import { Chip } from '../ui/Chip';
import { HeartsDisplay } from '../gamification/HeartsDisplay';
import { cefrBandForProficiencyLevel } from '../../lib/cefr-proficiency';
import { colors, spacing } from '../../config/theme';

export function StatsStrip() {
  const profile = useAppStore((s) => s.profile);
  const { hearts, maxHearts, isUnlimited } = useHearts();
  const { showStreak, showHearts, showXpCelebration } = useAdultMode();

  const streak = profile?.streak ?? 0;
  const totalXp = profile?.totalXp ?? 0;

  // Adult mode replaces the streak/XP/hearts row with a single competence
  // label. The point of the mode is that progress is measured in what you can
  // do, not in points earned — so this row states the level rather than a score.
  if (!showStreak && !showHearts && !showXpCelebration) {
    const band = cefrBandForProficiencyLevel(profile?.level ?? 'beginner');
    return (
      <View style={styles.row}>
        <Chip
          variant="primary"
          label={`Level ${band}`}
          leftIcon={<Ionicons name="ribbon-outline" size={14} color={colors.action.accent} />}
          style={styles.chip}
        />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Chip
        variant="streak"
        label={String(streak)}
        leftIcon={<Ionicons name="flame" size={14} color={colors.streak.fire} />}
        style={styles.chip}
      />
      <Chip
        variant="warning"
        label={totalXp.toLocaleString()}
        leftIcon={<Ionicons name="star" size={14} color={colors.warning.base} />}
        style={styles.chip}
      />
      <HeartsDisplay hearts={hearts} maxHearts={maxHearts} isUnlimited={isUnlimited} size={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  chip: {
    // Chip defaults to alignSelf flex-start; in a centered row it must not
    // stretch its own cross-axis.
    alignSelf: 'center',
  },
});
