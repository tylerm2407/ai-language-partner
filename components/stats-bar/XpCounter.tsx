import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface XpCounterProps {
  totalXp: number;
}

const XP_COLOR = '#38BDF8';

function XpCounterInner({ totalXp }: XpCounterProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [displayXp, setDisplayXp] = React.useState(totalXp);
  const prevXpRef = useRef(totalXp);

  useEffect(() => {
    const prev = prevXpRef.current;
    if (prev === totalXp) return;
    prevXpRef.current = totalXp;

    // Bounce animation
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.15, damping: 8, stiffness: 200, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 10, stiffness: 150, useNativeDriver: true }),
    ]).start();

    // Count up display
    const steps = 10;
    const stepDuration = 600 / steps;
    const diff = totalXp - prev;
    for (let i = 1; i <= steps; i++) {
      setTimeout(() => {
        setDisplayXp(Math.round(prev + (diff * i) / steps));
      }, stepDuration * i);
    }
  }, [totalXp, scale]);

  useEffect(() => {
    setDisplayXp(totalXp);
  }, []);

  return (
    <Animated.View
      style={[styles.container, { transform: [{ scale }] }]}
      accessibilityLabel={`${totalXp} total XP`}
      accessibilityRole="text"
    >
      <Ionicons name="flash" size={20} color={XP_COLOR} />
      <Text style={styles.text}>{displayXp}</Text>
    </Animated.View>
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
  text: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: 'bold',
    color: XP_COLOR,
  },
});

export const XpCounter = React.memo(XpCounterInner);
