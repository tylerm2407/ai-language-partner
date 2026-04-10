import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StreakIndicatorProps {
  streak: number;
  xpEarned: number;
  dailyGoalMet: boolean;
}

const COLD_COLOR = '#64748B';
const WARM_COLOR = '#FBBF24';
const BLAZING_COLOR = '#FFD700';

function StreakIndicatorInner({ streak, xpEarned, dailyGoalMet }: StreakIndicatorProps) {
  const isCold = xpEarned === 0;
  const isBlazing = dailyGoalMet;

  const color = isCold ? COLD_COLOR : isBlazing ? BLAZING_COLOR : WARM_COLOR;
  const period = isCold ? 0 : isBlazing ? 1000 : 2000;
  const maxScale = isCold ? 1.0 : 1.08;

  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isCold) {
      scale.setValue(1);
      glowOpacity.setValue(0);
      return;
    }

    const scaleAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: maxScale, duration: period / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    scaleAnim.start();

    let glowAnim: Animated.CompositeAnimation | null = null;
    if (isBlazing) {
      glowAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.6, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      glowAnim.start();
    } else {
      glowOpacity.setValue(0);
    }

    return () => {
      scaleAnim.stop();
      glowAnim?.stop();
    };
  }, [isCold, isBlazing, period, maxScale, scale, glowOpacity]);

  return (
    <View
      style={styles.container}
      accessibilityLabel={`${streak} day streak`}
      accessibilityRole="text"
    >
      <View style={styles.flameWrapper}>
        {isBlazing && (
          <Animated.View
            style={[
              styles.glowRing,
              { borderColor: BLAZING_COLOR },
              { opacity: glowOpacity },
            ]}
          />
        )}
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="flame" size={20} color={color} />
        </Animated.View>
      </View>
      <Text style={[styles.text, { color }]}>{streak}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  flameWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  text: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export const StreakIndicator = React.memo(StreakIndicatorInner);
