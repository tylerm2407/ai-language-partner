import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from '../ui/ProgressBar';
import { GradientBorderCard } from '../ui/GradientBorderCard';
import { ChallengeCompletePop } from '../animations/ChallengeCompletePop';
import { QuestCountdown } from './QuestCountdown';
import type { DailyStats } from '../../types';

interface DailyChallengesProps {
  dailyStats: DailyStats | null;
}

interface Challenge {
  type: string;
  title: string;
  icon: string;
  color: string;
  current: number;
  target: number;
  unit: string;
}

const chestIcons: Record<string, { outline: string; filled: string; color: string }> = {
  lessons: { outline: 'cube-outline', filled: 'cube', color: '#CD7F32' },
  cards: { outline: 'gift-outline', filled: 'gift', color: '#A855F7' },
  practice: { outline: 'diamond-outline', filled: 'diamond', color: '#34D399' },
};

export function DailyChallenges({ dailyStats }: DailyChallengesProps) {
  // Use hardcoded challenges based on daily stats (no DB dependency)
  const challenges: Challenge[] = [
    {
      type: 'lessons',
      title: 'Complete 2 lessons',
      icon: 'book',
      color: '#38BDF8',
      current: dailyStats?.lessonsCompleted ?? 0,
      target: 2,
      unit: 'lessons',
    },
    {
      type: 'cards',
      title: 'Review 10 cards',
      icon: 'layers',
      color: '#A855F7',
      current: dailyStats?.cardsReviewed ?? 0,
      target: 10,
      unit: 'cards',
    },
    {
      type: 'practice',
      title: 'Practice for 5 minutes',
      icon: 'time',
      color: '#34D399',
      current: dailyStats?.minutesPracticed ?? 0,
      target: 5,
      unit: 'min',
    },
  ];

  const completedCount = challenges.filter((c) => c.current >= c.target).length;
  const allComplete = completedCount === challenges.length;

  return (
    <GradientBorderCard innerStyle={{ padding: 20 }} style={{ marginBottom: 24 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-2">
          <Ionicons name="flag" size={18} color="#FBBF24" />
          <Text className="text-base font-semibold text-text-primary">Daily Challenges</Text>
        </View>
        <Text className="text-sm text-text-secondary">
          {completedCount}/{challenges.length}
        </Text>
      </View>
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-xs text-text-secondary">Complete all for +50 XP bonus</Text>
        <QuestCountdown />
      </View>

      {/* Challenge Items */}
      {challenges.map((challenge) => {
        const isComplete = challenge.current >= challenge.target;
        const progress = challenge.target > 0
          ? Math.min(challenge.current / challenge.target, 1)
          : 0;

        return (
          <View key={challenge.type} className="mb-4 last:mb-0">
            <View className="flex-row items-center mb-2">
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: isComplete ? '#34D39920' : challenge.color + '20',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 10,
                }}
              >
                {isComplete ? (
                  <ChallengeCompletePop trigger={true} />
                ) : (
                  <Ionicons
                    name={challenge.icon as any}
                    size={14}
                    color={challenge.color}
                  />
                )}
              </View>
              <Text
                className={`flex-1 text-sm ${
                  isComplete ? 'text-success line-through' : 'text-text-primary'
                }`}
              >
                {challenge.title}
              </Text>
              <Text className="text-xs text-text-secondary">
                {Math.min(challenge.current, challenge.target)}/{challenge.target} {challenge.unit}
              </Text>
              {chestIcons[challenge.type] && (
                <Ionicons
                  name={(isComplete
                    ? chestIcons[challenge.type].filled
                    : chestIcons[challenge.type].outline) as any}
                  size={16}
                  color={chestIcons[challenge.type].color}
                  style={{ marginLeft: 8 }}
                />
              )}
            </View>
            <View className="ml-[38px] flex-row items-center gap-2">
              <View className="flex-1">
                <ProgressBar progress={progress} height={6} />
              </View>
              <Text className="text-xs text-text-secondary" style={{ width: 32, textAlign: 'right' }}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          </View>
        );
      })}

      {/* Bonus XP Indicator */}
      {allComplete && (
        <View className="mt-3 pt-3 border-t border-dark-border">
          <View className="flex-row items-center justify-center gap-2">
            <Ionicons name="star" size={18} color="#FBBF24" />
            <Text className="text-sm font-semibold text-streak">
              All challenges complete! +50 Bonus XP
            </Text>
            <Ionicons name="star" size={18} color="#FBBF24" />
          </View>
        </View>
      )}
    </GradientBorderCard>
  );
}
