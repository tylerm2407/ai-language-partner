import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View
      className="flex-row items-center py-3"
      style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.06)' }}
      accessibilityLabel={`Student: ${displayName}`}
    >
      {/* Avatar */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Text
          style={{
            color: '#6366F1',
            fontSize: 16,
            fontFamily: 'Inter_700Bold',
          }}
        >
          {initial}
        </Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 15,
            fontFamily: 'Inter_600SemiBold',
          }}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Text
          style={{
            color: '#64748B',
            fontSize: 12,
            fontFamily: 'Inter_400Regular',
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
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round(completionRate * 100))}%`,
                backgroundColor:
                  completionRate >= 0.8 ? '#22C55E' : completionRate >= 0.5 ? '#F59E0B' : '#EF4444',
                borderRadius: 3,
              }}
            />
          </View>
          <Text
            style={{
              color: '#94A3B8',
              fontSize: 10,
              fontFamily: 'Inter_500Medium',
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
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </Pressable>
      )}
    </View>
  );
}
