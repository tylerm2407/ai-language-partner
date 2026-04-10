import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HeartIndicatorProps {
  hearts: number;
  isUnlimited: boolean;
}

const HEART_COLOR = '#EF4444';
const LOW_HEART_COLOR = '#DC2626';
const EMPTY_COLOR = '#64748B';

function HeartIndicatorInner({ hearts, isUnlimited }: HeartIndicatorProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const isZero = !isUnlimited && hearts === 0;
  const isLow = !isUnlimited && hearts === 1;

  const color = isZero ? EMPTY_COLOR : isLow ? LOW_HEART_COLOR : HEART_COLOR;
  const iconName = isZero ? 'heart-outline' : 'heart';

  useEffect(() => {
    if (isUnlimited || isZero) {
      scale.setValue(1);
      return;
    }

    const period = isLow ? 1000 : 3000;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: period / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();

    return () => anim.stop();
  }, [isUnlimited, isZero, isLow, scale]);

  const label = isUnlimited
    ? 'Unlimited hearts'
    : `${hearts} heart${hearts !== 1 ? 's' : ''} remaining`;

  return (
    <View
      style={styles.container}
      accessibilityLabel={label}
      accessibilityRole="text"
    >
      {isUnlimited ? (
        <>
          <Ionicons name="heart" size={20} color={HEART_COLOR} />
          <Text style={[styles.text, { color: HEART_COLOR }]}>∞</Text>
        </>
      ) : (
        <>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons name={iconName} size={20} color={color} />
          </Animated.View>
          <Text style={[styles.text, { color }]}>{hearts}</Text>
        </>
      )}
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
  text: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export const HeartIndicator = React.memo(HeartIndicatorInner);
