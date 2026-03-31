import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GradientBorderCard } from '../ui/GradientBorderCard';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';
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
  const leagueConfig = getLeagueConfig(tier);

  return (
    <GradientBorderCard innerStyle={{ padding: 20 }}>
      <View className="flex-row items-center mb-3">
        {/* Level circle */}
        <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', marginRight: 12 }}>
          <LinearGradient
            colors={[...GRADIENT_COLORS]}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }}>{level}</Text>
          </LinearGradient>
        </View>

        <View className="flex-1">
          <Text className="text-base font-semibold text-text-primary">Level {level}</Text>
          <Text className="text-xs text-text-secondary">{totalXp.toLocaleString()} total XP</Text>
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
      <View className="h-2 bg-dark-card-alt rounded-full overflow-hidden">
        <View style={{ width: `${Math.min(progress * 100, 100)}%`, height: '100%', borderRadius: 999 }}>
          <LinearGradient
            colors={[...GRADIENT_COLORS]}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={{ flex: 1, borderRadius: 999 }}
          />
        </View>
      </View>
      <Text className="text-xs text-text-tertiary mt-1">
        {level >= 100 ? 'Max level reached!' : `${xpInLevel} / ${xpToNextLevel} XP to level ${level + 1}`}
      </Text>
    </GradientBorderCard>
  );
}
