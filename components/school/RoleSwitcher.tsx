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
          backgroundColor: activeRole === 'learner' ? '#C8A24A' : 'transparent',
        }}
      >
        <Ionicons
          name="person-outline"
          size={16}
          color={activeRole === 'learner' ? '#14120E' : '#9C968A'}
        />
        <Text
          style={{
            color: activeRole === 'learner' ? '#14120E' : '#9C968A',
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
          backgroundColor: activeRole === 'teacher' ? '#C8A24A' : 'transparent',
        }}
      >
        <Ionicons
          name="school-outline"
          size={16}
          color={activeRole === 'teacher' ? '#14120E' : '#9C968A'}
        />
        <Text
          style={{
            color: activeRole === 'teacher' ? '#14120E' : '#9C968A',
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
