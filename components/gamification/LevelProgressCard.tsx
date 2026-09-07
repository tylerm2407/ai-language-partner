import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../ui2/SlabCard';
import { Ui2ProgressBar } from '../ui2/Ui2ProgressBar';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { getLeagueConfig } from '../../lib/levels';
import type { LeagueTier } from '../../lib/levels';

interface LevelProgressCardProps {
  level: number;
  tier: LeagueTier;
  xpInLevel: number;
  xpToNextLevel: number;
  progress: number;
  totalXp: number;
}

export function LevelProgressCard({ level, tier, xpInLevel, xpToNextLevel, progress, totalXp }: LevelProgressCardProps) {
  const { c } = useUi2Theme();
  const leagueConfig = getLeagueConfig(tier);

  return (
    <SlabCard style={{ padding: 20 }}>
      <View className="flex-row items-center mb-3">
        {/* Level circle — a flat primary disc; UI 2.0 has no gradients. */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            overflow: 'hidden',
            marginRight: 12,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: c.primary,
          }}
        >
          <Text style={{ color: c.onPrimary, fontSize: 20, fontWeight: '800' }}>{level}</Text>
        </View>

        <View className="flex-1">
          <Text className="text-base font-semibold" style={{ color: c.ink }}>Level {level}</Text>
          <Text className="text-xs" style={{ color: c.muted }}>{totalXp.toLocaleString()} total XP</Text>
        </View>

        {/* League badge */}
        <View className="flex-row items-center" style={{ backgroundColor: leagueConfig.color + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Ionicons name="shield" size={14} color={leagueConfig.color} />
          <Text style={{ color: leagueConfig.color, fontSize: 13, fontWeight: '700', marginLeft: 4 }}>
            {leagueConfig.label}
          </Text>
        </View>
      </View>

      {/* XP Progress bar */}
      <Ui2ProgressBar progress={progress} height={8} />
      <Text className="text-xs mt-1" style={{ color: c.muted }}>
        {level >= 100 ? 'Max level reached!' : `${xpInLevel} / ${xpToNextLevel} XP to level ${level + 1}`}
      </Text>
    </SlabCard>
  );
}
