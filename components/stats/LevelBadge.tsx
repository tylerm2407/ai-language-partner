import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GradientBorderCard } from '../ui/GradientBorderCard';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';
import type { ProficiencyLevel } from '../../types';

const LEVEL_CONFIG: Record<ProficiencyLevel, { label: string; color: string; bg: string; order: number }> = {
  beginner: { label: 'Beginner', color: '#34D399', bg: '#0D261A', order: 0 },
  elementary: { label: 'Elementary', color: '#60A5FA', bg: '#1A2340', order: 1 },
  intermediate: { label: 'Intermediate', color: '#38BDF8', bg: '#0C1A2E', order: 2 },
  upper_intermediate: { label: 'Upper Intermediate', color: '#A78BFA', bg: '#251A35', order: 3 },
  advanced: { label: 'Advanced', color: '#FBBF24', bg: '#26210F', order: 4 },
};

interface LevelBadgeProps {
  level: ProficiencyLevel;
}

export function LevelBadge({ level }: LevelBadgeProps) {
  const config = LEVEL_CONFIG[level];
  const progress = (config.order + 1) / 5;

  return (
    <GradientBorderCard innerStyle={{ padding: 20 }}>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-sans-semibold text-text-primary">Your Level</Text>
        <View className="flex-row items-center" style={{ backgroundColor: config.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Ionicons name="trophy" size={14} color={config.color} />
          <Text style={{ color: config.color, fontFamily: 'Inter_700Bold', fontSize: 13, marginLeft: 4 }}>
            {config.label}
          </Text>
        </View>
      </View>

      {/* Progress toward next level — gradient fill */}
      <View className="h-2 bg-dark-card-alt rounded-full overflow-hidden">
        <View style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 999 }}>
          <LinearGradient
            colors={[...GRADIENT_COLORS]}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={{ flex: 1, borderRadius: 999 }}
          />
        </View>
      </View>
      <Text className="text-xs text-text-tertiary mt-1 font-sans">
        {config.order < 4
          ? `Next: ${LEVEL_CONFIG[Object.keys(LEVEL_CONFIG)[config.order + 1] as ProficiencyLevel].label}`
          : 'Highest level reached!'}
      </Text>
    </GradientBorderCard>
  );
}
