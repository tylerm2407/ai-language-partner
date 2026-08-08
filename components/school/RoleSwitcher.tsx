import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../config/theme';

interface RoleSwitcherProps {
  activeRole: 'learner' | 'teacher';
  onSwitch: (role: 'learner' | 'teacher') => void;
}

export default function RoleSwitcher({ activeRole, onSwitch }: RoleSwitcherProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface.cardAlt,
        borderRadius: 12,
        padding: 3,
      }}
      accessibilityRole="tablist"
    >
      {/* Student tab */}
      <Pressable
        onPress={() => onSwitch('learner')}
        accessibilityRole="tab"
        accessibilityLabel="Student mode"
        accessibilityState={{ selected: activeRole === 'learner' }}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: activeRole === 'learner' ? '#4F46E5' : 'transparent',
        }}
      >
        <Ionicons
          name="person-outline"
          size={16}
          color={activeRole === 'learner' ? '#FFFFFF' : '#94A3B8'}
        />
        <Text
          style={{
            color: activeRole === 'learner' ? '#FFFFFF' : '#94A3B8',
            fontSize: 14,
            fontFamily: 'Nunito_600SemiBold',
            marginLeft: 6,
          }}
        >
          Student
        </Text>
      </Pressable>

      {/* Teacher tab */}
      <Pressable
        onPress={() => onSwitch('teacher')}
        accessibilityRole="tab"
        accessibilityLabel="Teacher mode"
        accessibilityState={{ selected: activeRole === 'teacher' }}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: activeRole === 'teacher' ? '#4F46E5' : 'transparent',
        }}
      >
        <Ionicons
          name="school-outline"
          size={16}
          color={activeRole === 'teacher' ? '#FFFFFF' : '#94A3B8'}
        />
        <Text
          style={{
            color: activeRole === 'teacher' ? '#FFFFFF' : '#94A3B8',
            fontSize: 14,
            fontFamily: 'Nunito_600SemiBold',
            marginLeft: 6,
          }}
        >
          Teacher
        </Text>
      </Pressable>
    </View>
  );
}
