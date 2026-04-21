import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '../ui/GlassSurface';
import StatusBadge from './StatusBadge';
import type { Assignment, AssignmentSubmission } from '../../types';

interface AssignmentCardProps {
  assignment: Assignment;
  onPress: () => void;
  submission?: AssignmentSubmission;
}

function getDueColor(dueAt: string | null): string {
  if (!dueAt) return '#64748B';
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const hoursLeft = (due - now) / (1000 * 60 * 60);
  if (hoursLeft < 0) return '#EF4444';
  if (hoursLeft < 24) return '#F59E0B';
  return '#22C55E';
}

function formatDue(dueAt: string | null): string {
  if (!dueAt) return 'No due date';
  const date = new Date(dueAt);
  const now = Date.now();
  const diff = date.getTime() - now;
  if (diff < 0) return 'Overdue';
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return hours <= 0 ? 'Due soon' : `Due in ${hours}h`;
  }
  return `Due ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

const MODE_ICON: Record<Assignment['mode'], string> = {
  text: 'chatbubble-outline',
  voice: 'mic-outline',
  either: 'options-outline',
};

const MODE_LABEL: Record<Assignment['mode'], string> = {
  text: 'Text',
  voice: 'Voice',
  either: 'Text or Voice',
};

export default function AssignmentCard({ assignment, onPress, submission }: AssignmentCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Assignment: ${assignment.title}`}
    >
      <GlassSurface
        style={{ marginBottom: 12 }}
        innerStyle={{ padding: 16 }}
      >
        {/* Header row */}
        <View className="flex-row items-center justify-between mb-1">
          <Text
            className="text-lg text-text-primary flex-1 mr-2"
            style={{ fontFamily: 'Inter_600SemiBold' }}
            numberOfLines={1}
          >
            {assignment.title}
          </Text>
          {submission && <StatusBadge status={submission.status} size="small" />}
        </View>

        {/* Description */}
        {assignment.description ? (
          <Text
            className="text-sm text-text-secondary mb-3"
            numberOfLines={2}
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            {assignment.description}
          </Text>
        ) : null}

        {/* Meta row */}
        <View className="flex-row items-center flex-wrap" style={{ gap: 12 }}>
          {/* Due date */}
          <View
            className="flex-row items-center"
            accessibilityLabel={`Due date: ${formatDue(assignment.dueAt)}`}
          >
            <Ionicons name="calendar-outline" size={14} color={getDueColor(assignment.dueAt)} />
            <Text
              style={{
                color: getDueColor(assignment.dueAt),
                fontSize: 12,
                fontFamily: 'Inter_500Medium',
                marginLeft: 4,
              }}
            >
              {formatDue(assignment.dueAt)}
            </Text>
          </View>

          {/* Mode */}
          <View className="flex-row items-center">
            <Ionicons
              name={MODE_ICON[assignment.mode] as any}
              size={14}
              color="#94A3B8"
            />
            <Text
              style={{
                color: '#94A3B8',
                fontSize: 12,
                fontFamily: 'Inter_500Medium',
                marginLeft: 4,
              }}
            >
              {MODE_LABEL[assignment.mode]}
            </Text>
          </View>

          {/* Min duration */}
          {assignment.minDurationMinutes > 0 && (
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={14} color="#94A3B8" />
              <Text
                style={{
                  color: '#94A3B8',
                  fontSize: 12,
                  fontFamily: 'Inter_500Medium',
                  marginLeft: 4,
                }}
              >
                {assignment.minDurationMinutes} min
              </Text>
            </View>
          )}
        </View>
      </GlassSurface>
    </Pressable>
  );
}
