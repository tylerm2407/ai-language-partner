/**
 * FloatingTabBar — 240×56 pill, 40px active circle, 44pt hit targets.
 *
 * Geometry is unchanged. The BlurView + translucent fill are gone: the pill is
 * now an opaque surface.card with a 1px border, matching every other surface
 * under the Dark Glow theme (and no longer smearing the glow blobs behind it).
 * That also drops the iOS/Android fork — both platforms render identically.
 */

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '../../config/theme';
import { BORDER_GRADIENT_COLORS } from '../../config/gradients';
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
                colors={[...BORDER_GRADIENT_COLORS]}
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

  return (
    <View style={[styles.container, { bottom: bottomOffset }]}>
      <View style={styles.pill}>{inner}</View>
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
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.card,
    overflow: 'hidden',
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
