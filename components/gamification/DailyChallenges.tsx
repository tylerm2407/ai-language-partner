import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Ui2ProgressBar } from '../ui2/Ui2ProgressBar';
import { SlabCard } from '../ui2/SlabCard';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { ChallengeCompletePop } from '../animations/ChallengeCompletePop';
import { QuestCountdown } from './QuestCountdown';
import { useDailyChallenges } from '../../hooks/useDailyChallenges';
import type { DailyStats } from '../../types';

interface DailyChallengesProps {
  dailyStats: DailyStats | null;
}

export function DailyChallenges({ dailyStats }: DailyChallengesProps) {
  const { c } = useUi2Theme();
  const { challenges, allCompleted } = useDailyChallenges();

  const completedCount = challenges.filter((ch) => ch.completed).length;

  return (
    <SlabCard style={{ padding: 20, marginBottom: 24 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-2">
          <Ionicons name="flag" size={18} color={c.yellow} />
          <Text className="text-base font-semibold" style={{ color: c.ink }}>Daily Challenges</Text>
        </View>
        <Text className="text-sm" style={{ color: c.muted }}>
          {completedCount}/{challenges.length}
        </Text>
      </View>
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-xs" style={{ color: c.muted }}>Three focused goals for today</Text>
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
                  backgroundColor: isComplete ? c.greenTint : challenge.color + '20',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 10,
                }}
              >
                {!isComplete && (
                  <Ionicons
                    name={challenge.icon as any}
                    size={14}
                    color={challenge.color}
                  />
                )}
                {/* Rendered unconditionally, and passed the real flag rather
                    than a hardcoded `true`, so it stays mounted across the
                    moment the challenge is finished. Swapping it in only once
                    complete meant it could never see the transition — every
                    appearance looked identical to it, whether the learner had
                    just earned it or opened the screen on yesterday's. It
                    renders nothing while `trigger` is false. */}
                <ChallengeCompletePop trigger={isComplete} />
              </View>
              {/* Done is carried by the strike-through and the tint behind the
                  icon, not by a green label: `green` as 14px text lands near
                  2:1 on a light card. */}
              <Text
                className={`flex-1 text-sm ${isComplete ? 'line-through' : ''}`}
                style={{ color: isComplete ? c.muted : c.ink }}
              >
                {challenge.title}
              </Text>
              <Text className="text-xs" style={{ color: c.muted }}>
                {Math.min(challenge.current, challenge.target)}/{challenge.target} {challenge.unit}
              </Text>
            </View>
            <View className="ml-[38px] flex-row items-center gap-2">
              <View className="flex-1">
                <Ui2ProgressBar progress={progress} height={6} />
              </View>
              <Text className="text-xs" style={{ width: 32, textAlign: 'right', color: c.muted }}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          </View>
        );
      })}

      {/* Completion indicator */}
      {allCompleted && (
        <View className="mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: c.cardBorder }}>
          <View className="flex-row items-center justify-center gap-2">
            <Ionicons name="checkmark-circle" size={18} color={c.green} />
            <Text className="text-sm font-semibold" style={{ color: c.ink }}>
              All challenges complete today
            </Text>
          </View>
        </View>
      )}
    </SlabCard>
  );
}
