import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '../../config/theme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  index: { active: 'home', inactive: 'home-outline' },
  learn: { active: 'book', inactive: 'book-outline' },
  chat: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

const VISIBLE_TABS = ['index', 'learn', 'chat', 'profile'];

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 16) + 12;

  const visibleRoutes = state.routes.filter((route) => VISIBLE_TABS.includes(route.name));

  const inner = (
    <View style={styles.tabRow}>
      {visibleRoutes.map((route) => {
        const realIndex = state.routes.indexOf(route);
        const isFocused = state.index === realIndex;
        const icons = TAB_ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
        const iconName = isFocused ? icons.active : icons.inactive;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tabButton}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={route.name === 'index' ? 'Home' : route.name}
          >
            {isFocused ? (
              <LinearGradient
                colors={[colors.magazine.accentBlue, colors.magazine.accentViolet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.activeCircle}
              >
                <Ionicons name={iconName as any} size={22} color="#FFFFFF" />
              </LinearGradient>
            ) : (
              <View style={styles.inactiveCircle}>
                <Ionicons name={iconName as any} size={22} color={colors.text.tertiary} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  if (Platform.OS === 'android') {
    return (
      <View style={[styles.container, { bottom: bottomOffset }]}>
        <View style={[styles.pill, styles.pillFallback]}>
          {inner}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { bottom: bottomOffset }]}>
      <View style={styles.pill}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.pillOverlay}>
          {inner}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    width: 240,
    height: 56,
    borderRadius: radii.pill,
    borderWidth: 0.5,
    borderColor: colors.magazine.glassBorder,
    overflow: 'hidden',
  },
  pillOverlay: {
    flex: 1,
    backgroundColor: colors.magazine.glassBg,
  },
  pillFallback: {
    backgroundColor: colors.magazine.glassBg,
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  tabButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
