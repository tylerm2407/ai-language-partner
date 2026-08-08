import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GradientBorderCard } from '../ui/GradientBorderCard';
import { GRADIENT_COLORS, GRADIENT_START, GRADIENT_END } from '../../config/gradients';
import type { ProficiencyLevel } from '../../types';

const LEVEL_CONFIG: Record<ProficiencyLevel, { label: string; color: string; bg: string; order: number }> = {
  // Proficiency maps to BRIGHTNESS — beginner is the dimmest label and advanced
  // the brightest, so the ladder is legible without five competing hues. The
  // green that briefly landed on `beginner` here was wrong twice over: it is
  // the lowest rank wearing the most emphatic colour, and green is reserved for
  // correct answers (config/theme.ts §Semantic).
  beginner: { label: 'Beginner', color: '#6B7076', bg: '#141618', order: 0 },
  elementary: { label: 'Elementary', color: '#8C9198', bg: '#141618', order: 1 },
  intermediate: { label: 'Intermediate', color: '#ADB3BA', bg: '#1C1F22', order: 2 },
  upper_intermediate: { label: 'Upper Intermediate', color: '#C9CDD2', bg: '#1C1F22', order: 3 },
  advanced: { label: 'Advanced', color: '#F2F4F6', bg: '#1C1F22', order: 4 },
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
