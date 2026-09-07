import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../ui2/SlabCard';
import StatusBadge from './StatusBadge';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { Ui2Palette } from '../../config/theme';
import type { Assignment, AssignmentSubmission } from '../../types';

interface AssignmentCardProps {
  assignment: Assignment;
  onPress: () => void;
  submission?: AssignmentSubmission;
}

/** Takes the palette rather than reading a hook: it is called from JSX inside
 *  the component, and a helper that called `useUi2Theme()` itself would be a
 *  conditional hook the moment one of these branches stops rendering. */
function getDueColor(dueAt: string | null, c: Ui2Palette): string {
  if (!dueAt) return c.muted;
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const hoursLeft = (due - now) / (1000 * 60 * 60);
  if (hoursLeft < 0) return c.error;
  if (hoursLeft < 24) return c.yellow;
  return c.green;
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
  const { c } = useUi2Theme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Assignment: ${assignment.title}`}
    >
      <SlabCard
        style={{ marginBottom: 12 }}
      >
        {/* Header row */}
        <View className="flex-row items-center justify-between mb-1">
          <Text
            className="text-lg flex-1 mr-2"
            style={{ fontFamily: 'Nunito_600SemiBold', color: c.ink }}
            numberOfLines={1}
          >
            {assignment.title}
          </Text>
          {submission && <StatusBadge status={submission.status} size="small" />}
        </View>

        {/* Description */}
        {assignment.description ? (
          <Text
            className="text-sm mb-3"
            numberOfLines={2}
            style={{ fontFamily: 'Nunito_400Regular', color: c.muted }}
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
            <Ionicons name="calendar-outline" size={14} color={getDueColor(assignment.dueAt, c)} />
            <Text
              style={{
                color: getDueColor(assignment.dueAt, c),
                fontSize: 12,
                fontFamily: 'Nunito_500Medium',
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
              color={c.muted}
            />
            <Text
              style={{
                color: c.muted,
                fontSize: 12,
                fontFamily: 'Nunito_500Medium',
                marginLeft: 4,
              }}
            >
              {MODE_LABEL[assignment.mode]}
            </Text>
          </View>

          {/* Min duration */}
          {assignment.minDurationMinutes > 0 && (
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={14} color={c.muted} />
              <Text
                style={{
                  color: c.muted,
                  fontSize: 12,
                  fontFamily: 'Nunito_500Medium',
                  marginLeft: 4,
                }}
              >
                {assignment.minDurationMinutes} min
              </Text>
            </View>
          )}
        </View>
      </SlabCard>
    </Pressable>
  );
}
