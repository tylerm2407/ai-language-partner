import { View, Text, ActivityIndicator } from 'react-native';
import { colors, spacing, typography } from '../../config/theme';
import { Body } from '../ui/Text';
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
      {/* Section header — sentence case title with a mono count, matching the
          other editorial section heads (Home's "Continue learning"). */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.xs }}>
        <Body size="lg" weight="extrabold">
          Achievements
        </Body>
        <Text
          style={{
            fontFamily: typography.family.mono,
            fontSize: typography.scale.tiny.fontSize,
            color: colors.text.tertiary,
          }}
        >
          {loading ? '—' : `${earnedCount} / ${TOTAL}`}
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color="#C9CDD2" />
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
