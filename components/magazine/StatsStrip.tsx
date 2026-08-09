/**
 * StatsStrip — the streak / XP / hearts row under the Home greeting.
 *
 * Was: three Chips with Ionicons (streak in orange, XP in amber) plus hearts.
 * Now: one mono meta row — `7 DAY · 1,240 XP` — reading as a dateline rather
 * than as a scoreboard.
 *
 * Three saturated pills stacked directly under the greeting was the Duolingo
 * header, and it was also spending the loudest color on the screen on numbers
 * the learner is not being asked to act on. The numbers stay (they are real
 * progress) but they are set in the same mono voice as DateLabel, one type step
 * down, and the indigo accent is reserved for the CTA further down the screen.
 *
 * Hearts keep their glyph row: hearts are a spendable resource and the count
 * has to be readable at a glance, which a mono numeral does not do as well as
 * five filled/empty shapes.
 *
 * Render conditions are unchanged — this is a restyle, not a behaviour change.
 */

import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../stores/useAppStore';
import { useHearts } from '../../hooks/useHearts';
import { useAdultMode } from '../../hooks/useAdultMode';
import { HeartsDisplay } from '../gamification/HeartsDisplay';
import { cefrBandForProficiencyLevel } from '../../lib/cefr-proficiency';
import { colors, spacing, typography } from '../../config/theme';

function Separator() {
  return <Text style={[styles.meta, styles.separator]}>·</Text>;
}

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
        <Ionicons name="ribbon-outline" size={13} color={colors.action.accent} />
        <Text style={[styles.meta, styles.emphasis]}>LEVEL {band}</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.meta, styles.emphasis]}>{streak}</Text>
      <Text style={styles.meta}>DAY</Text>
      <Separator />
      <Text style={[styles.meta, styles.emphasis]}>{totalXp.toLocaleString()}</Text>
      <Text style={styles.meta}>XP</Text>
      <Separator />
      <HeartsDisplay hearts={hearts} maxHearts={maxHearts} isUnlimited={isUnlimited} size={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // Wraps rather than clips: at the accessibility text sizes this row's
    // 12pt mono runs past the screen width and the hearts fall off the end.
    flexWrap: 'wrap',
    gap: spacing.xxs,
    marginBottom: spacing.lg,
  },
  /** Mono meta voice, matching DateLabel. lineHeight is deliberately left to
   *  the face's natural line box — see config/theme.ts §leading. */
  meta: {
    fontFamily: typography.family.mono,
    fontSize: 12,
    letterSpacing: typography.tracking.eyebrow,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  /** The value itself, not its unit. Brighter than the unit label so the pair
   *  reads as one figure with a caption rather than two words. */
  emphasis: {
    fontFamily: typography.family.monoMedium,
    color: colors.text.primary,
  },
  separator: {
    color: colors.text.quaternary,
    marginHorizontal: spacing.xxs,
  },
});
