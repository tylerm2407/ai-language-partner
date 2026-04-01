import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, Animated, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { ProgressBar } from '../ui/ProgressBar';
import { GradientBorderCard } from '../ui/GradientBorderCard';
import { useOnboardingChecklist } from '../../hooks/useOnboardingChecklist';
import { useProfile } from '../../hooks/useProfile';

const CONFETTI_COLORS = ['#FBBF24', '#34D399', '#38BDF8', '#A855F7', '#F472B6', '#60A5FA'];
const PARTICLE_COUNT = 10;

function ConfettiParticle({ index }: { index: number }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
    const distance = 60 + Math.random() * 50;
    const delay = index * 30;

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.delay(500),
          Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.spring(scale, { toValue: 1, speed: 30, bounciness: 10, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: Math.cos(angle) * distance, speed: 10, bounciness: 6, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: Math.sin(angle) * distance, speed: 10, bounciness: 6, useNativeDriver: true }),
      ]),
    ]).start();
  }, [index, translateX, translateY, opacity, scale]);

  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const shapes = ['ellipse', 'star-outline', 'diamond-outline'] as const;
  const size = 6 + (index % 3) * 3;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        transform: [{ translateX }, { translateY }, { scale }],
        opacity,
      }}
    >
      <Ionicons name={shapes[index % shapes.length]} size={size} color={color} />
    </Animated.View>
  );
}

export function OnboardingChecklist() {
  const router = useRouter();
  const { earnXp } = useProfile();
  const {
    isVisible,
    items,
    completedCount,
    totalCount,
    allComplete,
    progress,
    collapsed,
    markItem,
    toggleCollapsed,
    dismiss,
  } = useOnboardingChecklist();

  const [showConfetti, setShowConfetti] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(false);
  const collapseAnim = useRef(new Animated.Value(collapsed ? 0 : 1)).current;

  // Animate collapse/expand
  useEffect(() => {
    Animated.timing(collapseAnim, {
      toValue: collapsed ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [collapsed, collapseAnim]);

  // All complete → confetti + XP + auto-dismiss
  useEffect(() => {
    if (allComplete && !xpAwarded && isVisible) {
      setShowConfetti(true);
      setXpAwarded(true);
      earnXp(50);

      const timer = setTimeout(() => {
        dismiss();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [allComplete, xpAwarded, isVisible, earnXp, dismiss]);

  const handleItemPress = useCallback(async (key: string, route: string | null) => {
    if (key === 'dailyReminder') {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          await markItem('dailyReminder');
        } else {
          Alert.alert(
            'Notifications Disabled',
            'Enable notifications in your device settings to set daily reminders.',
            [{ text: 'OK' }]
          );
        }
      } catch {
        Alert.alert('Error', 'Could not request notification permissions.');
      }
      return;
    }

    if (route) {
      router.push(route as any);
    }
  }, [markItem, router]);

  if (!isVisible) return null;

  const contentHeight = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, items.length * 48 + 16],
  });

  const contentOpacity = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <GradientBorderCard innerStyle={{ padding: 20 }} style={{ marginBottom: 24 }}>
      {/* Header */}
      <Pressable
        className="flex-row items-center justify-between"
        onPress={toggleCollapsed}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'Expand onboarding checklist' : 'Collapse onboarding checklist'}
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="rocket-outline" size={18} color="#38BDF8" />
          <Text className="text-base font-semibold text-text-primary">Get Started</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-text-secondary">{completedCount}/{totalCount}</Text>
          <Ionicons
            name={collapsed ? 'chevron-down' : 'chevron-up'}
            size={18}
            color="#64748B"
          />
        </View>
      </Pressable>

      {/* Progress Bar */}
      <View className="mt-3 mb-1">
        <ProgressBar progress={progress} />
      </View>

      {/* Collapsed summary */}
      {collapsed && (
        <Text className="text-xs text-text-secondary mt-2">
          {completedCount} of {totalCount} complete — tap to expand
        </Text>
      )}

      {/* Expandable items list */}
      <Animated.View style={{ height: contentHeight, opacity: contentOpacity, overflow: 'hidden' }}>
        <View className="mt-3">
          {items.map((item) => (
            <Pressable
              key={item.key}
              className="flex-row items-center py-2.5"
              onPress={() => !item.completed && handleItemPress(item.key, item.route)}
              disabled={item.completed}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}${item.completed ? ', completed' : ''}`}
              accessibilityState={{ checked: item.completed }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: item.completed ? 0 : 2,
                  borderColor: '#64748B',
                  backgroundColor: item.completed ? '#22C55E' : 'transparent',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                {item.completed && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
              </View>
              <Ionicons
                name={item.icon as any}
                size={18}
                color={item.completed ? '#22C55E' : '#94A3B8'}
                style={{ marginRight: 10 }}
              />
              <Text
                className={`flex-1 text-sm ${
                  item.completed ? 'text-success line-through' : 'text-text-primary'
                }`}
              >
                {item.label}
              </Text>
              {!item.completed && item.route && (
                <Ionicons name="chevron-forward" size={16} color="#64748B" />
              )}
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* Confetti on all complete */}
      {showConfetti && (
        <View style={{ position: 'absolute', top: '50%', left: '50%', zIndex: 10 }}>
          {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
            <ConfettiParticle key={i} index={i} />
          ))}
          <View style={{ position: 'absolute', top: -20, left: -60, width: 120 }}>
            <Text className="text-center text-sm font-bold text-streak">+50 XP!</Text>
          </View>
        </View>
      )}
    </GradientBorderCard>
  );
}
