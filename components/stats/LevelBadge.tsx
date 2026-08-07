import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GradientBorderCard } from '../ui/GradientBorderCard';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';
import type { ProficiencyLevel } from '../../types';

const LEVEL_CONFIG: Record<ProficiencyLevel, { label: string; color: string; bg: string; order: number }> = {
  // Each badge is a hue-tinted dark fill carrying its own label color. The
  // fills are graphite tinted toward the label's hue, not the saturated
  // navy/plum they used to be — see DESIGN.md §Surfaces.
  beginner: { label: 'Beginner', color: '#4E9F6B', bg: '#16271D', order: 0 },
  elementary: { label: 'Elementary', color: '#86B4CE', bg: '#1B2530', order: 1 },
  intermediate: { label: 'Intermediate', color: '#A8C6DC', bg: '#1B1A17', order: 2 },
  upper_intermediate: { label: 'Upper Intermediate', color: '#B497C4', bg: '#26202D', order: 3 },
  advanced: { label: 'Advanced', color: '#E0BE6B', bg: '#262013', order: 4 },
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
          <Text style={{ color: config.color, fontFamily: 'Nunito_700Bold', fontSize: 13, marginLeft: 4 }}>
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
