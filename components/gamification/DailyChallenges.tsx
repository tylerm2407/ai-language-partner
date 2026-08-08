import { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from '../ui/ProgressBar';
import { GlassSurface } from '../ui/GlassSurface';
import { ChallengeCompletePop } from '../animations/ChallengeCompletePop';
import { QuestCountdown } from './QuestCountdown';
import { useDailyChallenges } from '../../hooks/useDailyChallenges';
import type { DailyStats } from '../../types';

interface DailyChallengesProps {
  dailyStats: DailyStats | null;
}

export function DailyChallenges({ dailyStats }: DailyChallengesProps) {
  const { challenges, allCompleted, bonusXpClaimed, multiplier, claimBonusXp } = useDailyChallenges();
  const [claiming, setClaiming] = useState(false);

  const completedCount = challenges.filter((c) => c.completed).length;

  const handleClaimBonus = async () => {
    setClaiming(true);
    try {
      await claimBonusXp();
    } catch (err) {
      console.error('Failed to claim bonus XP:', err);
      Alert.alert('Claim failed', 'Could not claim your bonus XP. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <GlassSurface innerStyle={{ padding: 20 }} style={{ marginBottom: 24 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-2">
          <Ionicons name="flag" size={18} color="#E2E6EA" />
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
                  backgroundColor: isComplete ? '#3FB95020' : challenge.color + '20',
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
      {allCompleted && (
        <View className="mt-3 pt-3 border-t border-dark-border">
          {bonusXpClaimed ? (
            <View className="flex-row items-center justify-center gap-2">
              <Ionicons name="star" size={18} color="#E2E6EA" />
              <Text className="text-sm font-semibold text-streak">
                All challenges complete! +{Math.round(50 * multiplier)} Bonus XP claimed
              </Text>
              <Ionicons name="star" size={18} color="#E2E6EA" />
            </View>
          ) : (
            <Pressable
              onPress={handleClaimBonus}
              disabled={claiming}
              style={{ opacity: claiming ? 0.6 : 1 }}
            >
              <View className="flex-row items-center justify-center gap-2">
                <Ionicons name="star" size={18} color="#E2E6EA" />
                <Text className="text-sm font-semibold text-streak">
                  Claim +{Math.round(50 * multiplier)} Bonus XP
                </Text>
                <Ionicons name="star" size={18} color="#E2E6EA" />
              </View>
            </Pressable>
          )}
        </View>
      )}
    </GlassSurface>
  );
}
