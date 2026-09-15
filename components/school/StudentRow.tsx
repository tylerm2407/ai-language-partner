import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface StudentRowProps {
  studentId: string;
  displayName: string;
  enrolledAt: string;
  completionRate?: number;
  onRemove?: () => void;
}

function formatEnrolledDate(iso: string): string {
  const date = new Date(iso);
  return `Joined ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export default function StudentRow({
  studentId,
  displayName,
  enrolledAt,
  completionRate,
  onRemove,
}: StudentRowProps) {
  const { c } = useUi2Theme();
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View
      className="flex-row items-center py-3"
      style={{ borderBottomWidth: 1, borderBottomColor: c.cardBorder }}
      accessibilityLabel={`Student: ${displayName}`}
    >
      {/* Avatar */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: c.primaryTint,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Text
          style={{
            color: c.onTint,
            fontSize: 16,
            fontFamily: 'Manrope_700Bold',
          }}
        >
          {initial}
        </Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: c.ink,
            fontSize: 15,
            fontFamily: 'Manrope_600SemiBold',
          }}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Text
          style={{
            color: c.muted,
            fontSize: 12,
            fontFamily: 'Manrope_400Regular',
            marginTop: 2,
          }}
        >
          {formatEnrolledDate(enrolledAt)}
        </Text>
      </View>

      {/* Completion rate bar */}
      {completionRate != null && (
        <View
          style={{ width: 60, marginRight: 12 }}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Completion rate: ${Math.round(completionRate * 100)}%`}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(completionRate * 100) }}
        >
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: c.track,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round(completionRate * 100))}%`,
                backgroundColor:
                  completionRate >= 0.8 ? c.green : completionRate >= 0.5 ? c.yellow : c.error,
                borderRadius: 3,
              }}
            />
          </View>
          <Text
            style={{
              color: c.muted,
              fontSize: 10,
              fontFamily: 'Manrope_500Medium',
              textAlign: 'center',
              marginTop: 2,
            }}
          >
            {Math.round(completionRate * 100)}%
          </Text>
        </View>
      )}

      {/* Remove button */}
      {onRemove && (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${displayName}`}
          hitSlop={8}
          style={{ padding: 4 }}
        >
          <Ionicons name="trash-outline" size={18} color={c.error} />
        </Pressable>
      )}
    </View>
  );
}
