import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AchievementDefinition } from '../../lib/achievements';

interface AchievementBadgeProps {
  achievement: AchievementDefinition;
  earned: boolean;
  earnedAt?: string;
  isNew?: boolean;
}

export function AchievementBadge({ achievement, earned, earnedAt, isNew }: AchievementBadgeProps) {
  const formattedDate = earnedAt
    ? new Date(earnedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : undefined;

  return (
    <View style={{ width: 72, alignItems: 'center', marginBottom: 16 }}>
      {/* Badge tile */}
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: earned ? achievement.color + '20' : '#1C2029',
          opacity: earned ? 1 : 0.4,
        }}
      >
        <Ionicons
          name={achievement.icon as any}
          size={32}
          color={earned ? achievement.color : '#333A48'}
        />

        {/* Lock overlay for unearned */}
        {!earned && (
          <View
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
            }}
          >
            <Ionicons name="lock-closed" size={14} color="#333A48" />
          </View>
        )}

        {/* NEW badge */}
        {isNew && earned && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              backgroundColor: '#EF4444',
              borderRadius: 8,
              paddingHorizontal: 4,
              paddingVertical: 1,
              minWidth: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '700' }}>NEW</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text
        className="text-text-secondary text-center mt-1"
        style={{ fontSize: 10, lineHeight: 13 }}
        numberOfLines={2}
      >
        {achievement.title}
      </Text>

      {/* Earned date */}
      {earned && formattedDate && (
        <Text
          className="text-text-secondary"
          style={{ fontSize: 9, marginTop: 1 }}
        >
          {formattedDate}
        </Text>
      )}
    </View>
  );
}
