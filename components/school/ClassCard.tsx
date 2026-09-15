import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlabCard } from '../ui2/SlabCard';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { Classroom } from '../../types';

interface ClassCardProps {
  classroom: Classroom;
  onPress: () => void;
  showStudentCount?: boolean;
}

function levelLabel(level: string): string {
  return level
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function ClassCard({ classroom, onPress, showStudentCount }: ClassCardProps) {
  const { c } = useUi2Theme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Class: ${classroom.name}`}
    >
      <SlabCard
        style={{ marginBottom: 12 }}
      >
        {/* Name */}
        <Text
          className="text-lg mb-1"
          style={{ fontFamily: 'Manrope_600SemiBold', color: c.ink }}
          numberOfLines={1}
        >
          {classroom.name}
        </Text>

        {/* Language + level row */}
        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <Text
            style={{
              color: c.muted,
              fontSize: 13,
              fontFamily: 'Manrope_500Medium',
              textTransform: 'uppercase',
            }}
          >
            {classroom.targetLanguage}
          </Text>
          <View
            style={{
              backgroundColor: c.primaryTint,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                color: c.onTint,
                fontSize: 11,
                fontFamily: 'Manrope_600SemiBold',
              }}
            >
              {levelLabel(classroom.level)}
            </Text>
          </View>
        </View>

        {/* Counts row */}
        <View className="flex-row items-center" style={{ gap: 16 }}>
          {showStudentCount && classroom.studentCount != null && (
            <View className="flex-row items-center">
              <Ionicons name="people-outline" size={14} color={c.muted} />
              <Text
                style={{
                  color: c.muted,
                  fontSize: 12,
                  fontFamily: 'Manrope_500Medium',
                  marginLeft: 4,
                }}
              >
                {classroom.studentCount} student{classroom.studentCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {classroom.activeAssignmentCount != null && classroom.activeAssignmentCount > 0 && (
            <View className="flex-row items-center">
              <Ionicons name="document-text-outline" size={14} color={c.onTint} />
              <Text
                style={{
                  color: c.onTint,
                  fontSize: 12,
                  fontFamily: 'Manrope_500Medium',
                  marginLeft: 4,
                }}
              >
                {classroom.activeAssignmentCount} active
              </Text>
            </View>
          )}
        </View>
      </SlabCard>
    </Pressable>
  );
}
