import { View, Text, ActivityIndicator } from 'react-native';
import { spacing, typography } from '../../config/theme';
import { Body } from '../ui2/Ui2Text';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { ACHIEVEMENTS } from '../../lib/achievements';
import { useAchievements } from '../../hooks/useAchievements';
import { AchievementBadge } from './AchievementBadge';

const allAchievements = Object.values(ACHIEVEMENTS);
export const ACHIEVEMENT_TOTAL = allAchievements.length;
const TOTAL = ACHIEVEMENT_TOTAL;

/** The grid with its data fetched here. Screens that also need the count
 *  elsewhere (the profile's stat tiles) call `useAchievements` once and render
 *  `AchievementGridView` themselves, so the achievements are read once. */
export function AchievementGrid() {
  return <AchievementGridView {...useAchievements()} />;
}

export type AchievementGridViewProps = Pick<
  ReturnType<typeof useAchievements>,
  'earnedAchievements' | 'loading' | 'isNewInSession'
>;

export function AchievementGridView({ earnedAchievements, loading, isNewInSession }: AchievementGridViewProps) {
  const { c } = useUi2Theme();

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
            color: c.muted,
          }}
        >
          {loading ? '—' : `${earnedCount} / ${TOTAL}`}
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color={c.primary} />
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
