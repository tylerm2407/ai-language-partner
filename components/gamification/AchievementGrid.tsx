import { View, Text, ActivityIndicator } from 'react-native';
import { ACHIEVEMENTS } from '../../lib/achievements';
import { useAchievements } from '../../hooks/useAchievements';
import { AchievementBadge } from './AchievementBadge';

const allAchievements = Object.values(ACHIEVEMENTS);
const TOTAL = allAchievements.length;

export function AchievementGrid() {
  const { earnedAchievements, loading, isNewInSession } = useAchievements();

  const earnedMap = new Map(
    earnedAchievements.map((e) => [e.type, e.earnedAt])
  );
  const earnedCount = earnedMap.size;

  return (
    <View className="mb-4">
      {/* Section header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text className="text-base font-bold text-text-primary" style={{ letterSpacing: 1 }}>
          ACHIEVEMENTS
        </Text>
        <Text className="text-sm text-text-secondary">
          {loading ? '...' : `${earnedCount}/${TOTAL}`}
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          {allAchievements.map((achievement) => {
            const earnedAt = earnedMap.get(achievement.type);
            const earned = !!earnedAt;

            return (
              <AchievementBadge
                key={achievement.type}
                achievement={achievement}
                earned={earned}
                earnedAt={earnedAt}
                isNew={isNewInSession(achievement.type)}
              />
            );
          })}
          {/* Spacer items for even 4-column layout */}
          {allAchievements.length % 4 !== 0 &&
            Array.from({ length: 4 - (allAchievements.length % 4) }).map((_, i) => (
              <View key={`spacer-${i}`} style={{ width: 72 }} />
            ))}
        </View>
      )}
    </View>
  );
}
