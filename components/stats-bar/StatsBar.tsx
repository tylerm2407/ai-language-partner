import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../stores/useAppStore';
import { useHearts } from '../../hooks/useHearts';
import { useLevel } from '../../hooks/useLevel';
import { useAdultMode } from '../../hooks/useAdultMode';
import { StreakIndicator } from './StreakIndicator';
import { DailyGoalRing } from './DailyGoalRing';
import { XpCounter } from './XpCounter';
import { HeartIndicator } from './HeartIndicator';
import { LevelProgressStrip } from './LevelProgressStrip';
import { colors } from '../../config/theme';

function StatsBarInner() {
  const profile = useAppStore((s) => s.profile);
  const dailyStats = useAppStore((s) => s.dailyStats);
  const { hearts, isUnlimited } = useHearts();
  const { progress: levelProgress } = useLevel();
  const { showStreak, showHearts, showXpCelebration } = useAdultMode();
  const insets = useSafeAreaInsets();

  const streak = profile?.streak ?? 0;
  const totalXp = profile?.totalXp ?? 0;
  const xpEarned = dailyStats?.xpEarned ?? 0;
  const minutesPracticed = dailyStats?.minutesPracticed ?? 0;
  const dailyGoalMinutes = profile?.dailyGoalMinutes ?? 15;
  const dailyGoalMet = minutesPracticed >= dailyGoalMinutes;

  const dailyGoalProgress = dailyGoalMinutes > 0
    ? Math.min(1, minutesPracticed / dailyGoalMinutes)
    : 0;

  return (
    <View style={[styles.outer, { paddingTop: insets.top }]}>
      {/* Adult mode keeps only the daily-goal ring: that target is one the
          learner set for themselves, unlike the streak/XP/hearts pressure. */}
      <View style={styles.row}>
        {showStreak && (
          <StreakIndicator
            streak={streak}
            xpEarned={xpEarned}
            dailyGoalMet={dailyGoalMet}
          />
        )}
        <DailyGoalRing progress={dailyGoalProgress} />
        {showXpCelebration && <XpCounter totalXp={totalXp} />}
        {showHearts && <HeartIndicator hearts={hearts} isUnlimited={isUnlimited} />}
      </View>
      {showXpCelebration && <LevelProgressStrip progress={levelProgress} />}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: colors.surface.base,
  },
  row: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
});

export const StatsBar = React.memo(StatsBarInner);
