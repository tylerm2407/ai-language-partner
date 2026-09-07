import { useEffect, useRef } from 'react';
import { Text, Animated, Easing } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface XpPopupProps {
  xp: number;
  visible: boolean;
  onDone: () => void;
}

export function XpPopup({ xp, visible, onDone }: XpPopupProps) {
  const { c } = useUi2Theme();
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (visible && xp > 0) {
      // Reset
      translateY.setValue(0);
      opacity.setValue(0);
      scale.setValue(0.5);

      // Animate in
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 250, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      ]).start();

      // Float up and fade out
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(translateY, { toValue: -80, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(400),
            Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]),
        ]),
      ]).start(({ finished }) => {
        if (finished) onDone();
      });
    }
  }, [visible, xp, translateY, opacity, scale, onDone]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: '40%',
        alignSelf: 'center',
        zIndex: 999,
        borderRadius: 20,
        // Flat primary block instead of the old purple→sky gradient: UI 2.0
        // grounds on solid fills, and the shadow now tints with the scheme.
        backgroundColor: c.primary,
        shadowColor: c.slab,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
        overflow: 'hidden',
        paddingHorizontal: 20,
        paddingVertical: 10,
        transform: [{ translateY }, { scale }],
        opacity,
      }}
      pointerEvents="none"
    >
      <Text
        style={{
          color: c.onPrimary,
          fontSize: 24,
          fontFamily: 'Nunito_800ExtraBold',
          fontWeight: '800',
          textAlign: 'center',
        }}
      >
        +{xp} XP
      </Text>
    </Animated.View>
  );
}
