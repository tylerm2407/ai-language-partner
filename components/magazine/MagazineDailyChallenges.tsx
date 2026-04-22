import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MagazineGlassCard } from './MagazineGlassCard';
import { ProgressBar } from '../ui/ProgressBar';
import { QuestCountdown } from '../gamification/QuestCountdown';
import { colors, typography, radii } from '../../config/theme';
import type { DailyStats } from '../../types';

interface MagazineDailyChallengesProps {
  dailyStats: DailyStats | null;
}

const serifFont = Platform.select({ ios: 'Georgia', default: 'serif' });

interface Challenge {
  type: string;
  title: string;
  icon: string;
  color: string;
  current: number;
  target: number;
  xp: number;
}

export function MagazineDailyChallenges({ dailyStats }: MagazineDailyChallengesProps) {
  const challenges: Challenge[] = [
    {
      type: 'lessons',
      title: 'Complete 2 lessons',
      icon: 'book',
      color: '#38BDF8',
      current: dailyStats?.lessonsCompleted ?? 0,
      target: 2,
      xp: 15,
    },
    {
      type: 'cards',
      title: 'Review 10 cards',
      icon: 'layers',
      color: '#A855F7',
      current: dailyStats?.cardsReviewed ?? 0,
      target: 10,
      xp: 15,
    },
    {
      type: 'practice',
      title: 'Practice for 5 minutes',
      icon: 'time',
      color: '#34D399',
      current: dailyStats?.minutesPracticed ?? 0,
      target: 5,
      xp: 20,
    },
  ];

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
            <View style={styles.xpPill}>
              <Text style={styles.xpText}>+{c.xp}</Text>
            </View>
          </View>
        );
      })}
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
    fontWeight: '600',
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
});
