import React from 'react';
import { View, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radii } from '../../config/theme';

interface MagazineGlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function MagazineGlassCard({ children, style }: MagazineGlassCardProps) {
  // expo-blur works well on iOS; on Android use fallback
  if (Platform.OS === 'android') {
    return (
      <View style={[styles.fallback, style]}>
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.outer, style]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.inner}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: radii.xxl,
    borderWidth: 0.5,
    borderColor: colors.magazine.glassBorder,
    overflow: 'hidden',
  },
  inner: {
    backgroundColor: colors.magazine.glassBg,
    padding: 20,
  },
  fallback: {
    borderRadius: radii.xxl,
    borderWidth: 0.5,
    borderColor: colors.magazine.glassBorder,
    backgroundColor: colors.magazine.glassBg,
    padding: 20,
    overflow: 'hidden',
  },
});
