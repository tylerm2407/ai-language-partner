import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MagazineGlassCard } from './MagazineGlassCard';
import { ProgressBar } from '../ui/ProgressBar';
import { QuestCountdown } from '../gamification/QuestCountdown';
import { useDailyChallenges } from '../../hooks/useDailyChallenges';
import { colors, typography, radii } from '../../config/theme';
import type { DailyStats } from '../../types';

interface MagazineDailyChallengesProps {
  dailyStats: DailyStats | null;
}

// Editorial face. Fraunces_600SemiBold carries its own weight — never pair it
// with fontWeight, which makes Android synthesize a second bolding pass.
const serifFont = typography.family.serif;

export function MagazineDailyChallenges({ dailyStats }: MagazineDailyChallengesProps) {
  const { challenges, allCompleted } = useDailyChallenges();

  return (
    <MagazineGlassCard style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Your daily three</Text>
        <QuestCountdown />
      </View>

      {/* Challenge rows */}
      {challenges.map((c) => {
        const progress = c.target > 0 ? Math.min(c.current / c.target, 1) : 0;
        const isComplete = c.current >= c.target;

        return (
          <View key={c.type} style={styles.challengeRow}>
            <View style={[styles.iconCircle, { backgroundColor: c.color + '20' }]}>
              {isComplete ? (
                <Ionicons name="checkmark" size={14} color="#22C55E" />
              ) : (
                <Ionicons name={c.icon as any} size={14} color={c.color} />
              )}
            </View>
            <View style={styles.challengeText}>
              <Text
                style={[
                  styles.challengeTitle,
                  isComplete && styles.challengeComplete,
                ]}
              >
                {c.title}
              </Text>
              <View style={styles.progressRow}>
                <View style={styles.progressBarWrap}>
                  <ProgressBar progress={progress} height={4} />
                </View>
              </View>
            </View>
          </View>
        );
      })}

      {/* Finishing all three is worth saying out loud. There is nothing to
          claim: the reward for practising is the practice, and points are not
          something this product shows a learner any more. */}
      {allCompleted && (
        <View style={styles.bonusSection}>
          <Text style={styles.bonusClaimed}>All three done today</Text>
        </View>
      )}
    </MagazineGlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: serifFont,
    fontSize: 18,
    color: colors.text.primary,
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  challengeText: {
    flex: 1,
  },
  challengeTitle: {
    fontFamily: typography.family.regular,
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 4,
  },
  challengeComplete: {
    color: colors.success.base,
    textDecorationLine: 'line-through',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarWrap: {
    flex: 1,
  },
  xpPill: {
    backgroundColor: colors.magazine.xpGold + '20',
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 10,
  },
  xpText: {
    fontFamily: typography.family.monoMedium,
    fontSize: 11,
    color: colors.magazine.xpGold,
  },
  bonusSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.text.secondary + '40',
    alignItems: 'center',
  },
  bonusClaimed: {
    fontFamily: typography.family.regular,
    fontSize: 13,
    color: colors.success.base,
    fontWeight: '600',
  },
  bonusClaim: {
    fontFamily: typography.family.regular,
    fontSize: 13,
    color: colors.magazine.xpGold,
    fontWeight: '600',
  },
});
