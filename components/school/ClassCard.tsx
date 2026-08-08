import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '../ui/GlassSurface';
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Class: ${classroom.name}`}
    >
      <GlassSurface
        style={{ marginBottom: 12 }}
        innerStyle={{ padding: 16 }}
      >
        {/* Name */}
        <Text
          className="text-lg text-text-primary mb-1"
          style={{ fontFamily: 'Nunito_600SemiBold' }}
          numberOfLines={1}
        >
          {classroom.name}
        </Text>

        {/* Language + level row */}
        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <Text
            style={{
              color: '#80868C',
              fontSize: 13,
              fontFamily: 'Nunito_500Medium',
              textTransform: 'uppercase',
            }}
          >
            {classroom.targetLanguage}
          </Text>
          <View
            style={{
              backgroundColor: 'rgba(242, 244, 246, 0.2)',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                color: '#C9CDD2',
                fontSize: 11,
                fontFamily: 'Nunito_600SemiBold',
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
              <Ionicons name="people-outline" size={14} color="#5C6166" />
              <Text
                style={{
                  color: '#5C6166',
                  fontSize: 12,
                  fontFamily: 'Nunito_500Medium',
                  marginLeft: 4,
                }}
              >
                {classroom.studentCount} student{classroom.studentCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {classroom.activeAssignmentCount != null && classroom.activeAssignmentCount > 0 && (
            <View className="flex-row items-center">
              <Ionicons name="document-text-outline" size={14} color="#C9CDD2" />
              <Text
                style={{
                  color: '#C9CDD2',
                  fontSize: 12,
                  fontFamily: 'Nunito_500Medium',
                  marginLeft: 4,
                }}
              >
                {classroom.activeAssignmentCount} active
              </Text>
            </View>
          )}
        </View>
      </GlassSurface>
    </Pressable>
  );
}
