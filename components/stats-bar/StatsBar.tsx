import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../stores/useAppStore';
import { useHearts } from '../../hooks/useHearts';
import { useLevel } from '../../hooks/useLevel';
import { StreakIndicator } from './StreakIndicator';
import { DailyGoalRing } from './DailyGoalRing';
import { XpCounter } from './XpCounter';
import { HeartIndicator } from './HeartIndicator';
import { LevelProgressStrip } from './LevelProgressStrip';

function StatsBarInner() {
  const profile = useAppStore((s) => s.profile);
  const dailyStats = useAppStore((s) => s.dailyStats);
  const { hearts, isUnlimited } = useHearts();
  const { progress: levelProgress } = useLevel();
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
      <View style={styles.row}>
        <StreakIndicator
          streak={streak}
          xpEarned={xpEarned}
          dailyGoalMet={dailyGoalMet}
        />
        <DailyGoalRing progress={dailyGoalProgress} />
        <XpCounter totalXp={totalXp} />
        <HeartIndicator hearts={hearts} isUnlimited={isUnlimited} />
      </View>
      <LevelProgressStrip progress={levelProgress} />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: 'rgba(12, 15, 20, 0.95)',
  },
  row: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
});

export const StatsBar = React.memo(StatsBarInner);
